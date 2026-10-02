from django.conf import settings
from django.core.exceptions import ValidationError
from src.controller import status
from src.models import (
    DEFAULT_SYSTEM_PROMPT,
    SYSTEM_PROMPT_MAX_LENGTH,
    Conversation,
    Message,
)
from src.providers import ChatMessage, ProviderError, Replace, get_provider

DEFAULT_ASSISTANT_NAME = "Ethos"
ASSISTANT_NAME_MAX_LENGTH = 80


class ChatError(Exception):
    pass


def default_persona():
    return {"name": DEFAULT_ASSISTANT_NAME, "systemPrompt": DEFAULT_SYSTEM_PROMPT}


def clean_persona(data):
    """Pick the persona settings present in `data` and map them to model fields.

    A blank name or prompt resets it to the default, so the widget can always get back to a working assistant.
    """
    if not isinstance(data, dict):
        return {}
    fields = {}
    if "name" in data:
        fields["assistant_name"] = (
            str(data["name"] or "").strip()[:ASSISTANT_NAME_MAX_LENGTH]
            or DEFAULT_ASSISTANT_NAME
        )
    if "systemPrompt" in data:
        prompt = str(data["systemPrompt"] or "").strip()
        if len(prompt) > SYSTEM_PROMPT_MAX_LENGTH:
            raise ValueError(
                f"`systemPrompt` must be at most {SYSTEM_PROMPT_MAX_LENGTH} characters."
            )
        fields["system_prompt"] = prompt or DEFAULT_SYSTEM_PROMPT
    return fields


def serialize_conversation(conversation, with_messages=True):
    data = {
        "conversationId": str(conversation.pk),
        "persona": {
            "name": conversation.assistant_name,
            "systemPrompt": conversation.system_prompt,
        },
    }
    if with_messages:
        data["messages"] = [
            {
                "id": str(m.pk),
                "role": m.role,
                "text": m.content,
                "createdAt": int(m.created_at.timestamp() * 1000),
            }
            for m in conversation.messages.all()
        ]
    return data


def find_conversation(session, conversation_id):
    """Return the session's conversation, or None when the session or id is missing, malformed, unknown,
    or the conversation belongs to another browser."""
    if session is None or not conversation_id:
        return None
    try:
        return Conversation.objects.filter(pk=conversation_id, session=session).first()
    except ValidationError:
        return None


def update_persona(conversation, fields):
    changed = [
        name for name, value in fields.items() if getattr(conversation, name) != value
    ]
    if changed:
        for name in changed:
            setattr(conversation, name, fields[name])
        conversation.save(update_fields=[*changed, "updated_at"])
    return conversation


def get_or_create_conversation(session, conversation_id, persona_fields):
    conversation = find_conversation(session, conversation_id)
    if conversation is None:
        return Conversation.objects.create(session=session, **persona_fields)
    return update_persona(conversation, persona_fields)


def reply(conversation, text):
    """Store the user's message and stream the configured LLM's answer, given the conversation memory.

    Yields text chunks, or a Replace when the text so far must be swapped (a refusal mid-reply). The full
    answer is stored once the stream ends; raises ChatError if the provider fails.
    """
    Message.objects.create(
        conversation=conversation, role=Message.Role.USER, content=text
    )
    history = [
        ChatMessage(role=m.role, content=m.content)
        for m in conversation.recent_messages(settings.MEMORY_WINDOW)
    ]

    parts = []
    try:
        for chunk in get_provider().stream(
            conversation.render_system_prompt(), history
        ):
            if isinstance(chunk, Replace):
                parts = [chunk.text]
            else:
                parts.append(chunk)
            yield chunk
    except ProviderError as e:
        status.record(False, str(e))
        raise ChatError(str(e)) from e
    status.record(True)

    Message.objects.create(
        conversation=conversation,
        role=Message.Role.ASSISTANT,
        content="".join(parts).strip(),
    )
    conversation.save(update_fields=["updated_at"])
