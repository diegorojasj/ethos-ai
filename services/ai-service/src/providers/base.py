from contextlib import contextmanager
from dataclasses import dataclass
from types import ModuleType
from typing import Iterator, Literal, Protocol


@dataclass(frozen=True)
class ChatMessage:
    role: Literal["user", "assistant"]
    content: str


@dataclass(frozen=True)
class Replace:
    """Streamed instead of a text chunk: drop the text sent so far and show `text` (e.g. a refusal mid-reply)."""

    text: str


class ProviderError(Exception):
    """A failure whose message is safe to show to the end user."""


class ChatProvider(Protocol):
    model: str

    def stream(
        self, system: str, messages: list[ChatMessage]
    ) -> Iterator[str | Replace]:
        """Yield the assistant's reply to `messages` as it is generated, or raise ProviderError."""
        ...

    def check(self) -> None:
        """Cheaply confirm the provider can answer with `model` (no tokens generated), or raise ProviderError."""
        ...


def provider_detail(error) -> str:
    """The provider's own explanation from an API error body, e.g. "Application not found"."""
    body = getattr(error, "body", None)
    if isinstance(body, dict):
        nested = body.get("error")
        message = nested.get("message") if isinstance(nested, dict) else nested
        message = message or body.get("message") or body.get("detail")
        if isinstance(message, str) and message.strip():
            return message.strip()[:200]
    return ""


def with_detail(text: str, error) -> str:
    detail = provider_detail(error)
    return f'{text} The provider said: "{detail}"' if detail else text


@contextmanager
def translate_errors(sdk: ModuleType, model: str):
    """Turn an SDK's exceptions into ProviderError. The Anthropic and OpenAI SDKs share these class names."""
    try:
        yield
    except sdk.RateLimitError as e:
        raise ProviderError(
            "The assistant is busy right now, try again in a moment."
        ) from e
    except (sdk.AuthenticationError, sdk.PermissionDeniedError) as e:
        raise ProviderError(
            with_detail(
                "The AI provider rejected the credentials, check LLM_API_KEY.", e
            )
        ) from e
    except sdk.NotFoundError as e:
        # A 404 can mean an unknown model, but also a wrong endpoint or a key for another service.
        raise ProviderError(
            with_detail(
                f"The AI provider answered 404 for model {model!r}, check LLM_MODEL, LLM_API_KEY and the endpoint.",
                e,
            )
        ) from e
    except sdk.APIStatusError as e:
        raise ProviderError(
            with_detail(f"The AI provider returned an error ({e.status_code}).", e)
        ) from e
    except sdk.APIConnectionError as e:
        raise ProviderError("Could not reach the AI provider.") from e
