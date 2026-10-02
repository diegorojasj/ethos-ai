from src.models import BrowserSession

# The widget sends its session key in this header; the service answers with it when it issues a new one.
SESSION_HEADER = "X-Ethos-Session"


def find_session(request):
    """The browser session named by the request's header, or None when it is missing or unknown."""
    key = request.headers.get(SESSION_HEADER, "").strip()
    if not key:
        return None
    session = BrowserSession.objects.filter(key=key).first()
    if session is not None:
        session.touch()
    return session


def get_or_create_session(request):
    """The request's browser session, or a new one when it has none (first visit, cleared storage...)."""
    return find_session(request) or BrowserSession.objects.create(
        user_agent=request.headers.get("User-Agent", "")[:255]
    )
