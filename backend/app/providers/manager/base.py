import logging

from backend.app.core.config import load_yaml_config
from backend.app.providers.manager.llm import LLMProviderManager
from backend.app.providers.manager.music import MusicProviderManager

logger = logging.getLogger(__name__)


class ProviderManager:
    def __init__(self) -> None:
        self._config: dict = {}
        self._llm = LLMProviderManager()
        self._music = MusicProviderManager()

    def load_config(self, config: dict | None = None) -> None:
        self._config = config or load_yaml_config()
        self._llm.init(self._config)
        self._music.init(self._config)
        logger.info(
            "ProviderManager loaded: llm=%s music=%s",
            list(self._llm.providers.keys()),
            list(self._music.providers.keys()),
        )

    # ------ LLM delegation ------

    def get_llm_provider(self, task: str = "default"):
        return self._llm.get_provider(task)

    def list_llm_providers(self):
        return self._llm.list_providers()

    def get_llm_config(self):
        return self._llm.get_config(self._config)

    def update_llm_config(
        self,
        providers: list[dict],
        router: dict[str, str],
    ) -> None:
        """Update the LLM section and reinitialise providers."""
        self._config.setdefault("llm", {})
        self._config["llm"]["providers"] = providers
        self._config["llm"]["router"] = router
        self._llm.init(self._config)

    # ------ Music delegation ------

    def get_music_provider(self):
        return self._music.get_provider()

    async def list_music_providers(self):
        return await self._music.list_providers()

    def get_music_config(self):
        return self._music.get_config(self._config)

    def update_music_config(
        self,
        providers: list[dict],
        router: dict[str, str],
    ) -> None:
        """Update the music section and reinitialise providers."""
        self._config.setdefault("music", {})
        self._config["music"]["providers"] = providers
        self._config["music"]["router"] = router
        self._music.init(self._config)

    async def preload_music_model(self):
        await self._music.preload_model()


provider_manager = ProviderManager()
