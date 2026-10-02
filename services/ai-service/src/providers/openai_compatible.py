from collections.abc import Iterator

import openai
from openai.types.chat import ChatCompletionMessageParam

from src.providers.base import ChatMessage, ProviderError, Replace, translate_errors, with_detail


class OpenAICompatibleProvider:
    """Any server that speaks the OpenAI Chat Completions API: OpenAI, OpenRouter, Gemini, Nous, Mistral,
    Groq, DeepSeek, Ollama, vLLM... See the presets in settings.LLM_PROVIDERS."""

    default_model = None

    def __init__(self, model, max_tokens, api_key=None, base_url=None, effort=None, extra_body=None):
        self.model = model
        self.max_tokens = max_tokens
        # Only sent when set: models without reasoning support reject `reasoning_effort`.
        self.effort = effort
        # Provider-specific request fields beyond the OpenAI spec (e.g. Nous's required `tags`).
        self.extra_body = extra_body
        # Local servers such as Ollama accept any key, but the SDK insists on one.
        self.client = openai.OpenAI(api_key=api_key or "not-needed", base_url=base_url)

    def stream(self, system: str, messages: list[ChatMessage]) -> Iterator[str | Replace]:
        payload: list[ChatCompletionMessageParam] = [{"role": "system", "content": system}]
        for m in messages:
            if m.role == "user":
                payload.append({"role": "user", "content": m.content})
            else:
                payload.append({"role": "assistant", "content": m.content})
        with translate_errors(openai, self.model):
            chunks = self.client.chat.completions.create(
                model=self.model,
                max_completion_tokens=self.max_tokens,
                messages=payload,
                reasoning_effort=self.effort or openai.omit,
                extra_body=self.extra_body,
                stream=True,
            )
            refusal = ""
            for chunk in chunks:
                # Some servers send chunks without choices (usage, keep-alives).
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta is None:
                    continue
                if delta.content:
                    yield delta.content
                if delta.refusal:
                    refusal += delta.refusal
            if refusal:
                yield Replace(refusal)

    def check(self) -> None:
        with translate_errors(openai, self.model):
            try:
                self.client.models.retrieve(self.model)
                return
            except openai.NotFoundError:
                pass  # The model is unknown, or the API has no single-model lookup (OpenRouter...): ask the list.
            try:
                ids = {m.id for m in self.client.models.list()}
            except openai.NotFoundError as e:
                # Neither lookup exists: usually a wrong endpoint or a key for another service, not a healthy API.
                raise ProviderError(
                    with_detail("The AI provider answered 404 to its model list, check LLM_API_KEY and the endpoint.", e)
                ) from e
        # Some APIs prefix ids, e.g. Gemini's "models/gemini-2.5-flash".
        if not any(i == self.model or i.endswith(f"/{self.model}") for i in ids):
            raise ProviderError(f"The AI provider does not offer the model {self.model!r}, check LLM_MODEL.")
