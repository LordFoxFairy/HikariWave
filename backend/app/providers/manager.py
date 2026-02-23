import logging

from backend.app.core.config import load_yaml_config
from backend.app.providers.image.base import BaseImageProvider, ImageProviderConfig
from backend.app.providers.image.together import TogetherImageProvider
from backend.app.providers.llm.base import LLMProvider, LLMProviderConfig
from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicProviderConfig,
)
from backend.app.providers.music.huggingface import HuggingFaceMusicProvider

logger = logging.getLogger(__name__)

# Maps config "type" value → LangChain model_provider string
LLM_TYPE_TO_PROVIDER: dict[str, str] = {
    "openrouter": "openai",
    "openai": "openai",
    "openai_compat": "openai",
    "ollama": "openai",  # Ollama exposes /v1 OpenAI-compatible API
}

MUSIC_PROVIDER_CLASSES: dict[str, type[BaseMusicProvider]] = {
    "huggingface": HuggingFaceMusicProvider,
    "local_gpu": HuggingFaceMusicProvider,
}

IMAGE_PROVIDER_CLASSES: dict[str, type[BaseImageProvider]] = {
    "together": TogetherImageProvider,
}


class ProviderManager:
    def __init__(self) -> None:
        self._llm_providers: dict[str, LLMProvider] = {}
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
        self._llm_providers.clear()
        for entry in self._config.get("llm", {}).get("providers", []):
            name = entry["name"]
            config_type = entry.get("type", name)
            lc_provider = LLM_TYPE_TO_PROVIDER.get(config_type, "openai")

            base_url = entry.get("base_url", "")
            # Ollama: ensure base_url ends with /v1 for OpenAI-compat API
            is_ollama_missing_v1 = (
                    config_type == "ollama"
                    and base_url
                    and not base_url.rstrip("/").endswith("/v1")
            )
            if is_ollama_missing_v1:
                base_url = base_url.rstrip("/") + "/v1"

            cfg = LLMProviderConfig(
                name=name,
                provider_type=lc_provider,
                base_url=base_url,
                api_key=(
                        entry.get("api_key", "")
                        or ("ollama" if config_type == "ollama" else "")
                ),
                models=entry.get("models", []),
            )
            self._llm_providers[name] = LLMProvider(cfg)

    def _init_music_providers(self) -> None:
        self._music_providers.clear()
        for entry in self._config.get("music", {}).get("providers", []):
            provider_type = entry.get("type", "huggingface")
            cls = MUSIC_PROVIDER_CLASSES.get(provider_type)
            if cls is None:
                logger.warning("Unknown music provider type: %s", provider_type)
                cls = HuggingFaceMusicProvider
            for model_entry in entry.get("models", []):
                if isinstance(model_entry, dict):
                    model_name = model_entry["name"]
                    model_id = model_entry.get("model_id", "")
                    backend_type = model_entry.get("backend_type", "auto")
                else:
                    model_name = model_entry
                    model_id = ""
                    backend_type = "auto"
                cfg = MusicProviderConfig(
                    name=f"{entry['name']}:{model_name}",
                    provider_type=provider_type,
                    model_name=model_name,
                    model_id=model_id,
                    backend_type=backend_type,
                )
                key = f"{entry['name']}:{model_name}"
                self._music_providers[key] = cls(cfg)

    def _init_image_providers(self) -> None:
        self._image_providers.clear()
        for entry in self._config.get("image", {}).get("providers", []):
            name = entry["name"]
            provider_type = entry.get("type", name)
            cls = IMAGE_PROVIDER_CLASSES.get(provider_type)
            if cls is None:
                logger.warning("Unknown image provider: %s", provider_type)
                continue
            for model_name in entry.get("models", []):
                cfg = ImageProviderConfig(
                    name=f"{name}:{model_name}",
                    provider_type=provider_type,
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

    def get_llm_provider(self, task: str = "default") -> tuple[LLMProvider, str]:
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
                    "provider_type": "api",
                    "models": p.config.models,
                    "is_active": self._llm_router.get(
                        "default", ""
                    ).startswith(name + ":"),
                }
            )
        return result

    def get_llm_config(self) -> dict:
        """Return the full LLM configuration: providers + router."""
        providers = [
            {
                "name": entry["name"],
                "type": entry.get("type", entry["name"]),
                "base_url": entry.get("base_url", ""),
                "api_key": entry.get("api_key", ""),
                "models": entry.get("models", []),
            }
            for entry in self._config.get("llm", {}).get("providers", [])
        ]
        return {
            "providers": providers,
            "router": dict(self._llm_router),
        }

    def update_llm_config(self, providers: list[dict], router: dict[str, str]) -> None:
        """Update the LLM section of config and reinitialise providers."""
        self._config.setdefault("llm", {})
        self._config["llm"]["providers"] = providers
        self._config["llm"]["router"] = router
        self._init_llm_providers()
        self._llm_router = router

    # ------ Music public API ------

    def get_music_config(self) -> dict:
        """Return the full music configuration: providers + router."""
        providers = []
        for entry in self._config.get("music", {}).get("providers", []):
            models = []
            for m in entry.get("models", []):
                if isinstance(m, dict):
                    models.append({
                        "name": m["name"],
                        "model_id": m.get("model_id", ""),
                    })
                else:
                    models.append({"name": m, "model_id": ""})
            providers.append({
                "name": entry["name"],
                "type": entry.get("type", "huggingface"),
                "models": models,
            })
        return {
            "providers": providers,
            "router": dict(self._music_router),
        }

    def update_music_config(
            self, providers: list[dict], router: dict[str, str],
    ) -> None:
        """Update the music section of config and reinitialise providers."""
        self._config.setdefault("music", {})
        self._config["music"]["providers"] = providers
        self._config["music"]["router"] = router
        self._init_music_providers()
        self._music_router = router

    def get_music_provider(self) -> BaseMusicProvider:
        """Get the default music provider based on router config."""
        route = self._music_router.get("default", "")
        provider = self._music_providers.get(route)
        if provider is None:
            # Fallback: return the first available provider
            if self._music_providers:
                return next(iter(self._music_providers.values()))
            raise RuntimeError(f"Music provider not found: {route}")
        return provider

    def list_music_providers(self) -> list[dict]:
        result = []
        for key, p in self._music_providers.items():
            result.append(
                {
                    "name": key,
                    "provider_type": p.config.provider_type,
                    "models": [p.config.model_name],
                    "is_active": p.is_loaded,
                }
            )
        return result

    async def preload_music_model(self) -> None:
        """Preload the default music provider model (download + init)."""
        try:
            provider = self.get_music_provider()
            logger.info(
                "Preloading music model: %s",
                provider.config.model_id,
            )
            await provider.load_model()
            logger.info(
                "Music model preloaded successfully: %s",
                provider.config.model_id,
            )
        except Exception:
            logger.warning(
                "Music model preload failed "
                "(will retry on first generation)",
                exc_info=True,
            )

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
                    "provider_type": p.config.provider_type,
                    "models": [p.config.model_name],
                    "is_active": p.is_loaded,
                }
            )
        return result


provider_manager = ProviderManager()
