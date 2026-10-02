import secrets

from django.db import models
from django.utils import timezone


def new_session_key():
    return secrets.token_urlsafe(32)


class BrowserSession(models.Model):
    """One browser using the widget. The server issues `key`, the widget keeps it and sends it back on every
    request, so each browser only reaches its own conversations."""

    key = models.CharField(max_length=64, unique=True, default=new_session_key)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)

    objects = models.Manager()

    class Meta:
        db_table = "sessions"

    def touch(self):
        self.last_seen_at = timezone.now()
        self.save(update_fields=["last_seen_at"])
