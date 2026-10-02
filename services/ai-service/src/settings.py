import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
    "django_mongodb_backend",
    "src.apps.EthosConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "src.urls"
WSGI_APPLICATION = "src.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "27017"),
        "USER": os.environ.get("DB_USER", ""),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "NAME": os.environ.get("DB_NAME", "ethosIA"),
        # The mongo image creates DB_USER as a root user in the admin database.
        "OPTIONS": {"authSource": os.environ.get("DB_AUTH_SOURCE", "admin")},
    }
}
DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"

USE_TZ = True
TIME_ZONE = "UTC"

def env(name, default=""):
    """An env var, treating a blank value (e.g. `LLM_MODEL=` in .env) the same as an unset one."""
    return os.environ.get(name, "").strip() or default


# LLM: the app is model-agnostic. LLM_PROVIDER picks one of LLM_PROVIDERS below; any other
LLM_PROVIDERS = {
    "anthropic": {
        "backend": "anthropic",
        "api_key_env": "ANTHROPIC_API_KEY",
        "default_model": "claude-opus-5-5",
        # Chat replies are short; low effort starts answering much sooner. Raise LLM_EFFORT for harder work.
        "default_effort": "low",
    },
    "openai": {"backend": "openai", "api_key_env": "OPENAI_API_KEY"},
    "openrouter": {"backend": "openai", "api_key_env": "OPENROUTER_API_KEY"},
    "gemini": {"backend": "openai", "api_key_env": "GEMINI_API_KEY"},
    "nous": {
        "backend": "openai",
        "api_key_env": "NOUS_API_KEY",
        # Nous rejects API-key requests without a user tag ("missing tags"); the value is free-form.
        "options": {"extra_body": {"tags": ["user=ethos-ai"]}},
    },
    "upstage": {"backend": "openai", "api_key_env": "UPSTAGE_API_KEY"},
    "mistral": {"backend": "openai", "api_key_env": "MISTRAL_API_KEY"},
    "groq": {"backend": "openai", "api_key_env": "GROQ_API_KEY"},
    "deepseek": {"backend": "openai", "api_key_env": "DEEPSEEK_API_KEY"},
    "xai": {"backend": "openai", "api_key_env": "XAI_API_KEY"},
    "together": {"backend": "openai", "api_key_env": "TOGETHER_API_KEY"},
    "fireworks": {"backend": "openai", "api_key_env": "FIREWORKS_API_KEY"},
    "perplexity": {"backend": "openai", "api_key_env": "PERPLEXITY_API_KEY"},
    "cerebras": {"backend": "openai", "api_key_env": "CEREBRAS_API_KEY"},
    "huggingface": {"backend": "openai", "api_key_env": "HF_TOKEN"},
    # Local servers, no key needed.
    "ollama": {"backend": "openai"},
    "lmstudio": {"backend": "openai"},
    # vLLM, llama.cpp, LiteLLM, LocalAI, Azure OpenAI...: anything else speaking the OpenAI API.
    "openai-compatible": {"backend": "openai"},
}
# Providers whose SDK already knows the endpoint, so LLM_BASE_URL is optional for them.
LLM_SDK_DEFAULT_URL = {"anthropic", "openai"}


def resolve_llm():
    """Merge the LLM_* variables over the preset LLM_PROVIDER names. Missing required values stay None so the
    app still boots; src/providers reports them as a ProviderError the widget can show."""
    provider = env("LLM_PROVIDER", "anthropic").lower()
    preset = LLM_PROVIDERS.get(provider, {})
    key_env = preset.get("api_key_env")
    return {
        "PROVIDER": provider,
        # None when LLM_PROVIDER names no preset.
        "BACKEND": preset.get("backend"),
        # Model id as the provider names it.
        "MODEL": env("LLM_MODEL", preset.get("default_model")) or None,
        # The API endpoint. None means the SDK's own default, which only anthropic and openai have.
        "BASE_URL": env("LLM_BASE_URL") or None,
        # Falls back to the preset's own variable, e.g. OPENROUTER_API_KEY.
        "API_KEY": env("LLM_API_KEY", env(key_env) if key_env else "") or None,
        "API_KEY_ENV": key_env,
        # Upper bound on the tokens of one reply.
        "MAX_TOKENS": int(env("LLM_MAX_TOKENS", "16000")),
        # The accepted values are the provider's (Anthropic: low..max; OpenAI-style: minimal, low, medium, high).
        "EFFORT": env("LLM_EFFORT", preset.get("default_effort", "")).lower() or None,
        "OPTIONS": preset.get("options", {}),
    }


LLM = resolve_llm()

# How many stored messages are replayed to the model on each turn.
MEMORY_WINDOW = int(env("MEMORY_WINDOW", "50"))
