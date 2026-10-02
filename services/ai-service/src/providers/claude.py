from collections.abc import Iterator
from contextlib import contextmanager
from typing import Literal

import anthropic
from src.providers.base import ChatMessage, ProviderError, Replace, translate_errors

Effort = Literal["low", "medium", "high", "xhigh", "max"]

REFUSAL_REPLY = "Sorry, I can't help with that one."


class ClaudeProvider:
    def __init__(
        self,
        model,
        max_tokens,
        api_key=None,
        base_url=None,
        effort: Effort | None = None,
    ):
        self.model = model
        self.max_tokens = max_tokens
        self.effort = effort
        # base_url stays None for Anthropic's API; set LLM_BASE_URL to go through a proxy or gateway.
        self.client = anthropic.Anthropic(api_key=api_key, base_url=base_url)

    def stream(
        self, system: str, messages: list[ChatMessage]
    ) -> Iterator[str | Replace]:
        with (
            self.errors(),
            self.client.beta.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=[{"role": m.role, "content": m.content} for m in messages],
                thinking={"type": "adaptive"},
                # No effort means the API's own default.
                output_config={"effort": self.effort}
                if self.effort
                else anthropic.omit,
                cache_control={"type": "ephemeral"},
                # On a safety decline, re-run the request on Anthropic's recommended fallback model.
                fallbacks="default",
                betas=["server-side-fallback-2026-07-01"],
            ) as stream,
        ):
            yield from stream.text_stream
            # A fallback model continues on the same stream; a refusal here means every model declined,
            # possibly after some text was already sent.
            if stream.get_final_message().stop_reason == "refusal":
                yield Replace(REFUSAL_REPLY)

    def check(self) -> None:
        with self.errors():
            self.client.models.retrieve(self.model)

    @contextmanager
    def errors(self):
        try:
            with translate_errors(anthropic, self.model):
                yield
        except TypeError as e:
            # The SDK raises TypeError when no credentials could be resolved.
            raise ProviderError(
                "AI provider credentials are missing, set LLM_API_KEY."
            ) from e
