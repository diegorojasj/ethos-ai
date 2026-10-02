import json
import logging

from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from src.controller import chat, session, status
from src.providers import Replace

logger = logging.getLogger(__name__)


def parse_json(request):
    """The JSON object in the request body, or None when it is missing or malformed."""
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return None
    return body if isinstance(body, dict) else None


def ndjson(event):
    return json.dumps(event) + "\n"


def reply_events(conversation_id, first, chunks):
    """The reply as NDJSON lines: { type: "delta", text } per chunk, { type: "replace", text } to swap the text
    so far, then { type: "done", conversationId } or, if the provider fails mid-reply, { type: "error", error }."""
    try:
        chunk = first
        while chunk is not None:
            if isinstance(chunk, Replace):
                yield ndjson({"type": "replace", "text": chunk.text})
            elif chunk:
                yield ndjson({"type": "delta", "text": chunk})
            chunk = next(chunks, None)
    except chat.ChatError as e:
        logger.exception("Chat reply failed mid-stream")
        yield ndjson({"type": "error", "error": str(e)})
        return
    yield ndjson({"type": "done", "conversationId": conversation_id})


@csrf_exempt
@require_POST
def send_message(request):
    """POST { conversationId?, message, persona?: { name?, systemPrompt? } }

    Streams the reply as NDJSON (see reply_events), so the widget shows it while it is generated. A failure
    before any output still answers 502 { error, conversationId }. Both carry the browser's session key in the
    X-Ethos-Session header, a new one when the request had no valid key.
    """
    body = parse_json(request)
    if body is None:
        return JsonResponse({"error": "Body must be a JSON object."}, status=400)

    text = str(body.get("message") or "").strip()
    if not text:
        return JsonResponse({"error": "`message` is required."}, status=400)
    try:
        persona = chat.clean_persona(body.get("persona"))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

    browser = session.get_or_create_session(request)
    conversation = chat.get_or_create_conversation(browser, body.get("conversationId"), persona)
    conversation_id = str(conversation.pk)
    chunks = chat.reply(conversation, text)
    # Wait for the first chunk here: most failures (credentials, model, network) happen before any output.
    try:
        first = next(chunks, None)
    except chat.ChatError as e:
        logger.exception("Chat reply failed")
        response = JsonResponse({"error": str(e), "conversationId": conversation_id}, status=502)
        response[session.SESSION_HEADER] = browser.key
        return response

    response = StreamingHttpResponse(reply_events(conversation_id, first, chunks), content_type="application/x-ndjson")
    response["X-Conversation-Id"] = conversation_id
    response[session.SESSION_HEADER] = browser.key
    # Keep proxies (nginx) from buffering the stream.
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@require_GET
def default_persona(request):
    """GET -> { name, systemPrompt }: the settings a new conversation starts with."""
    return JsonResponse(chat.default_persona())


@require_GET
def ai_status(request):
    """GET [?refresh=1] -> { status: "available" | "unavailable", message, provider, model, checkedAt }

    Always 200: a failed request means the service itself is down, a body says how the AI is doing.
    """
    return JsonResponse(status.get_status(refresh=request.GET.get("refresh") == "1"))


@csrf_exempt
@require_http_methods(["GET", "PATCH", "DELETE"])
def conversation_detail(request, conversation_id):
    """The stored memory of a conversation, reachable only with the X-Ethos-Session header of the browser
    that started it (any other answers 404).

    GET returns its persona and messages; PATCH { name?, systemPrompt? } changes its persona
    (blank values reset to the default); DELETE forgets it.
    """
    conversation = chat.find_conversation(session.find_session(request), conversation_id)
    if conversation is None:
        return JsonResponse({"error": "Conversation not found."}, status=404)

    if request.method == "DELETE":
        conversation.delete()
        return HttpResponse(status=204)

    if request.method == "PATCH":
        body = parse_json(request)
        if body is None:
            return JsonResponse({"error": "Body must be a JSON object."}, status=400)
        try:
            chat.update_persona(conversation, chat.clean_persona(body))
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        return JsonResponse(chat.serialize_conversation(conversation, with_messages=False))

    return JsonResponse(chat.serialize_conversation(conversation))


urlpatterns = [
    path("chat", send_message),
    path("persona", default_persona),
    path("status", ai_status),
    path("conversations/<str:conversation_id>", conversation_detail),
]
