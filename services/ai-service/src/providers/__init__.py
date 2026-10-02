"""Model-agnostic access to chat LLMs. LLM_PROVIDER names a preset in settings.LLM_PROVIDERS; the rest of
the app only sees ChatProvider, so adding a vendor is one preset entry (or one backend module for a new API)."""

from functools import cache
from importlib import import_module

from django.conf import settings

from src.providers.base import ChatMessage, ChatProvider, ProviderError, Replace

__all__ = ["ChatMessage", "ChatProvider", "ProviderError", "Replace", "get_provider"]

# The client for each API style, imported lazily so only the SDK of the configured one has to be installed.
BACKENDS = {
    "anthropic": ("src.providers.claude", "ClaudeProvider"),
    "openai": ("src.providers.openai_compatible", "OpenAICompatibleProvider"),
}


@cache
def get_provider() -> ChatProvider:
    llm = settings.LLM
    name = llm["PROVIDER"]
    if llm["BACKEND"] is None:
        raise ProviderError(f"Unknown LLM_PROVIDER {name!r}, expected one of: {', '.join(settings.LLM_PROVIDERS)}.")

    module_name, class_name = BACKENDS[llm["BACKEND"]]
    try:
        provider_class = getattr(import_module(module_name), class_name)
    except ImportError as e:
        raise ProviderError(f"The SDK for LLM_PROVIDER={name!r} is not installed ({e.name}).") from e

    if not llm["MODEL"]:
        raise ProviderError(f"Set LLM_MODEL, LLM_PROVIDER={name!r} has no default model.")
    if not llm["BASE_URL"] and name not in settings.LLM_SDK_DEFAULT_URL:
        raise ProviderError(f"Set LLM_BASE_URL to the endpoint of LLM_PROVIDER={name!r}.")
    if llm["API_KEY_ENV"] and not llm["API_KEY"]:
        raise ProviderError(f"Set LLM_API_KEY (or {llm['API_KEY_ENV']}) for LLM_PROVIDER={name!r}.")

    return provider_class(
        model=llm["MODEL"],
        max_tokens=llm["MAX_TOKENS"],
        api_key=llm["API_KEY"],
        base_url=llm["BASE_URL"],
        effort=llm["EFFORT"],
        **llm["OPTIONS"],
    )
