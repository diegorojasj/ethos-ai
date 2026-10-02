from typing import TYPE_CHECKING

from django.db import models

from .session import BrowserSession

# Fixed identity line, always sent first; users can't edit it, only the name filled into `{name}`.
IDENTITY_PROMPT = "You are {name}, a friendly assistant living in a Messenger-style chat widget."
# The user-editable part of the instructions, sent after the identity line.
DEFAULT_SYSTEM_PROMPT = """Keep replies short and conversational, like a chat message. Use plain text; light markdown is fine.
You remember the earlier messages of this conversation, so build on them naturally."""
SYSTEM_PROMPT_MAX_LENGTH = 4000


class Conversation(models.Model):
    """One chat thread; its messages are the model's memory for that thread."""

    # The browser that owns this thread. Null only for threads stored before sessions existed; nobody can reach those.
    session = models.ForeignKey(BrowserSession, on_delete=models.CASCADE, related_name="conversations", null=True)
    assistant_name = models.CharField(max_length=80, default="Ethos")
    # The instructions the model gets for this thread, editable from the widget's settings.
    system_prompt = models.TextField(default=DEFAULT_SYSTEM_PROMPT, max_length=SYSTEM_PROMPT_MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Declared explicitly so type checkers see what Django's metaclass adds at runtime.
    objects = models.Manager()
    if TYPE_CHECKING:
        messages: models.Manager  # reverse of Message.conversation

    class Meta:
        db_table = "conversations"

    def render_system_prompt(self):
        identity = IDENTITY_PROMPT.replace("{name}", str(self.assistant_name))
        return f"{identity}\n\n{self.system_prompt}"

    def recent_messages(self, limit):
        """The last `limit` messages, oldest first, starting on a user turn."""
        recent = list(self.messages.order_by("-created_at")[:limit])[::-1]
        while recent and recent[0].role != Message.Role.USER:
            recent.pop(0)
        return recent


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user"
        ASSISTANT = "assistant"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    objects = models.Manager()

    class Meta:
        db_table = "messages"
        ordering = ["created_at"]
