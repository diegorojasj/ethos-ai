import threading
import time

from django.conf import settings
from src.providers import ProviderError, get_provider

AVAILABLE = "available"
UNAVAILABLE = "unavailable"

# A health check is reused for this long, so polling widgets don't hammer the provider.
CHECK_TTL_SECONDS = 30

_lock = threading.Lock()
_last: dict | None = None


def _snapshot(status, message=""):
    try:
        model = get_provider().model
    except ProviderError:
        model = settings.LLM["MODEL"]
    return {
        "status": status,
        "message": message,
        "provider": settings.LLM["PROVIDER"],
        "model": model,
        "checkedAt": int(time.time() * 1000),
    }


def record(ok, message=""):
    """Remember the outcome of a real request; it is fresher evidence than a health check."""
    global _last
    _last = _snapshot(AVAILABLE if ok else UNAVAILABLE, message)


def get_status(refresh=False):
    global _last
    with _lock:
        last = _last
        if (
            not refresh
            and last
            and time.time() * 1000 - last["checkedAt"] < CHECK_TTL_SECONDS * 1000
        ):
            return last
        try:
            get_provider().check()
        except ProviderError as e:
            record(False, str(e))
        else:
            record(True)
        return _last
