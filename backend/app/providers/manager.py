import logging

from backend.app.core.config import load_yaml_config
from backend.app.providers.image.base import BaseImageProvider, ImageProviderConfig
from backend.app.providers.image.together import TogetherImageProvider
from backend.app.providers.llm.base import BaseLLMProvider, LLMProviderConfig
from backend.app.providers.llm.openrouter import OpenRouterProvider
from backend.app.providers.music.ace_step import ACEStepProvider
from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicGenerationRequest,
    MusicProviderConfig,
)
from backend.app.providers.music.musicgen import MusicGenProvider

logger = logging.getLogger(__name__)

LLM_PROVIDER_CLASSES: dict[str, type[BaseLLMProvider]] = {
    "openrouter": OpenRouterProvider,
}

MUSIC_PROVIDER_CLASSES: dict[str, type[BaseMusicProvider]] = {
    "ace-step-v1": ACEStepProvider,
    "musicgen-large": MusicGenProvider,
}

IMAGE_PROVIDER_CLASSES: dict[str, type[BaseImageProvider]] = {
    "together": TogetherImageProvider,
}


class ProviderManager:
    def __init__(self) -> None:
        self._llm_providers: dict[str, BaseLLMProvider] = {}
        self._music_providers: dict[str, BaseMusicProvider] = {}
        self._image_providers: dict[str, BaseImageProvider] = {}
        self._llm_router: dict[str, str] = {}
        self._music_router: dict[str, str] = {}
        self._image_router: dict[str, str] = {}
        self._config: dict = {}

    def load_config(self, config: dict | None = None) -> None:
        self._config = config or load_yaml_config()
        self._init_llm_providers()
        self._init_music_providers()
        self._init_image_providers()
        self._llm_router = self._config.get("llm", {}).get("router", {})
        self._music_router = self._config.get("music", {}).get("router", {})
        self._image_router = self._config.get("image", {}).get("router", {})
        logger.info(
            "ProviderManager loaded: llm=%s music=%s image=%s",
            list(self._llm_providers.keys()),
            list(self._music_providers.keys()),
            list(self._image_providers.keys()),
        )

    # ------ initialisation helpers ------

    def _init_llm_providers(self) -> None:
        for entry in self._config.get("llm", {}).get("providers", []):
            name = entry["name"]
            cls = LLM_PROVIDER_CLASSES.get(name)
            if cls is None:
                logger.warning("Unknown LLM provider: %s", name)
                continue
            cfg = LLMProviderConfig(
                name=name,
                base_url=entry.get("base_url", ""),
                api_key=entry.get("api_key", ""),
                models=entry.get("models", []),
            )
            self._llm_providers[name] = cls(cfg)

    def _init_music_providers(self) -> None:
        for entry in self._config.get("music", {}).get("providers", []):
            for model_name in entry.get("models", []):
                cls = MUSIC_PROVIDER_CLASSES.get(model_name)
                if cls is None:
                    logger.warning("Unknown music model: %s", model_name)
                    continue
                cfg = MusicProviderConfig(
                    name=f"{entry['name']}:{model_name}",
                    provider_type=entry.get("type", "local_gpu"),
                    model_name=model_name,
                )
                key = f"{entry['name']}:{model_name}"
                self._music_providers[key] = cls(cfg)

    def _init_image_providers(self) -> None:
        for entry in self._config.get("image", {}).get("providers", []):
            name = entry["name"]
            cls = IMAGE_PROVIDER_CLASSES.get(name)
            if cls is None:
                logger.warning("Unknown image provider: %s", name)
                continue
            for model_name in entry.get("models", []):
                cfg = ImageProviderConfig(
                    name=f"{name}:{model_name}",
                    provider_type=entry.get("type", "api"),
                    model_name=model_name,
                    api_key=entry.get("api_key", ""),
                    base_url=entry.get("base_url", ""),
                    default_width=entry.get("default_width", 1024),
                    default_height=entry.get("default_height", 1024),
                )
                key = f"{name}:{model_name}"
                self._image_providers[key] = cls(cfg)

    # ------ routing helpers ------

    def _parse_route(self, route: str) -> tuple[str, str]:
        parts = route.split(":", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return parts[0], ""

    # ------ LLM public API ------

    def get_llm_provider(self, task: str = "default") -> tuple[BaseLLMProvider, str]:
        route = self._llm_router.get(task, self._llm_router.get("default", ""))
        provider_name, model = self._parse_route(route)
        provider = self._llm_providers.get(provider_name)
        if provider is None:
            raise RuntimeError(f"LLM provider not found: {provider_name}")
        return provider, model

    def list_llm_providers(self) -> list[dict]:
        result = []
        for name, p in self._llm_providers.items():
            result.append(
                {
                    "name": name,
                    "models": p.config.models,
                    "is_active": name in self._llm_router.get("default", ""),
                }
            )
        return result

    # ------ Music public API ------

    def get_music_provider(
        self, request: MusicGenerationRequest | None = None
    ) -> BaseMusicProvider:
        if request and request.lyrics:
            route = self._music_router.get("vocal", "")
        else:
            route = self._music_router.get("default", "")
        provider = self._music_providers.get(route)
        if provider is None:
            raise RuntimeError(f"Music provider not found: {route}")
        return provider

    def list_music_providers(self) -> list[dict]:
        result = []
        for key, p in self._music_providers.items():
            result.append(
                {
                    "name": key,
                    "model": p.config.model_name,
                    "type": p.config.provider_type,
                    "is_loaded": p.is_loaded,
                }
            )
        return result

    # ------ Image public API ------

    def get_image_provider(self, task: str = "default") -> BaseImageProvider | None:
        route = self._image_router.get(task, self._image_router.get("default", ""))
        if not route:
            return None
        provider = self._image_providers.get(route)
        if provider is None:
            logger.warning("Image provider not found: %s", route)
            return None
        return provider

    def list_image_providers(self) -> list[dict]:
        result = []
        for key, p in self._image_providers.items():
            result.append(
                {
                    "name": key,
                    "model": p.config.model_name,
                    "type": p.config.provider_type,
                    "is_loaded": p.is_loaded,
                }
            )
        return result


provider_manager = ProviderManager()
