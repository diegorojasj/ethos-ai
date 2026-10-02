import logging

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class EthosConfig(AppConfig):
    name = "src"
    label = "ethos"
    verbose_name = "Ethos AI"

    def ready(self):
        from django.conf import settings
        from src.providers import ProviderError, get_provider

        try:
            provider = get_provider()
        except ProviderError as e:
            logger.warning("AI provider not ready: %s", e)
        else:
            logger.info(
                "AI provider %r using model %r",
                settings.LLM["PROVIDER"],
                provider.model,
            )
