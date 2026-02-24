import asyncio
import gc
import logging

from backend.app.providers.music.base import (
    BaseMusicProvider,
    MusicProviderConfig,
)
from backend.app.providers.music.acestep import (
    AceStepHandlerProvider,
    AceStepMusicProvider,
)
from backend.app.providers.music.huggingface import HuggingFaceMusicProvider

logger = logging.getLogger(__name__)

# Flat lookup: type → default class (when no label is specified).
_PROVIDER_CLASSES: dict[str, type[BaseMusicProvider]] = {
    "huggingface": HuggingFaceMusicProvider,
    "acestep": AceStepMusicProvider,
}

# Label overrides: (type, label) → class.
_LABEL_OVERRIDES: dict[tuple[str, str], type[BaseMusicProvider]] = {
    ("acestep", "official"): AceStepHandlerProvider,
}


def _resolve_provider_class(
    provider_type: str, label: str,
) -> type[BaseMusicProvider]:
    """Resolve provider class from *provider_type* and optional *label*."""
    if label:
        key = (provider_type, label)
        cls = _LABEL_OVERRIDES.get(key)
        if cls is not None:
            return cls
        logger.warning(
            "Unknown label '%s' for type '%s', falling back to default",
            label, provider_type,
        )
    return _PROVIDER_CLASSES.get(provider_type, HuggingFaceMusicProvider)


class MusicProviderManager:
    def __init__(self) -> None:
        self.providers: dict[str, BaseMusicProvider] = {}
        self._router: dict[str, str] = {}

    def init(self, config: dict) -> None:
        # Unload existing providers before clearing to free GPU memory
        for name, p in self.providers.items():
            if p.is_loaded:
                try:
                    asyncio.get_event_loop().run_until_complete(p.unload_model())
                except RuntimeError:
                    # No running event loop — best-effort sync cleanup
                    p._model = None
                except Exception:
                    logger.warning("Failed to unload music provider %s", name, exc_info=True)
        if self.providers:
            self.providers.clear()
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
        for entry in config.get("music", {}).get("providers", []):
            provider_type = entry.get("type", "huggingface")
            provider_label = entry.get("label", "")
            for model_entry in entry.get("models", []):
                if isinstance(model_entry, dict):
                    model_name = model_entry["name"]
                    model_id = model_entry.get("model_id", "")
                    # Model-level label takes priority over provider-level
                    label = model_entry.get("label", "") or provider_label
                else:
                    model_name = model_entry
                    model_id = ""
                    label = provider_label
                model_kwargs = (
                    model_entry.get("model_kwargs", {})
                    if isinstance(model_entry, dict)
                    else {}
                )
                # Key format: "provider:model" or "provider:model:label"
                key = f"{entry['name']}:{model_name}"
                if label:
                    key = f"{key}:{label}"
                cfg = MusicProviderConfig(
                    name=key,
                    provider_type=provider_type,
                    label=label,
                    model_name=model_name,
                    model_id=model_id,
                    model_kwargs=model_kwargs,
                )
                cls = _resolve_provider_class(provider_type, label)
                self.providers[key] = cls(cfg)

        self._router = config.get("music", {}).get("router", {})

    def _resolve_route(self, route: str) -> BaseMusicProvider | None:
        """Resolve a route string to a provider.

        Supports both ``provider:model`` and ``provider:model:label``.
        If an exact match isn't found and the route has no label part,
        try matching the first provider whose key starts with the route.
        """
        provider = self.providers.get(route)
        if provider is not None:
            return provider
        # Fallback: route without label, find first key that matches prefix
        prefix = route + ":"
        for key, p in self.providers.items():
            if key.startswith(prefix) or key == route:
                return p
        return None

    def get_provider(self, task: str = "default") -> BaseMusicProvider:
        """Get a music provider based on router config for the given task."""
        route = self._router.get(task, "") or self._router.get("default", "")
        provider = self._resolve_route(route)
        if provider is None:
            if self.providers:
                return next(iter(self.providers.values()))
            raise RuntimeError(f"Music provider not found: {route}")
        return provider

    async def list_providers(self) -> list[dict]:
        result = []
        for key, p in self.providers.items():
            is_downloaded = await asyncio.to_thread(p.check_downloaded)
            result.append(
                {
                    "name": key,
                    "provider_type": p.config.provider_type,
                    "label": p.config.label,
                    "models": [p.config.model_name],
                    "is_active": p.is_loaded,
                    "is_downloaded": is_downloaded,
                }
            )
        return result

    def get_config(self, full_config: dict) -> dict:
        """Return the full music configuration: providers + router."""
        providers = []
        for entry in full_config.get("music", {}).get("providers", []):
            models = []
            for m in entry.get("models", []):
                if isinstance(m, dict):
                    entry_dict = {
                        "name": m["name"],
                        "model_id": m.get("model_id", ""),
                    }
                    if m.get("label"):
                        entry_dict["label"] = m["label"]
                    if m.get("model_kwargs"):
                        entry_dict["model_kwargs"] = m["model_kwargs"]
                    models.append(entry_dict)
                else:
                    models.append({"name": m, "model_id": ""})
            provider_entry: dict = {
                "name": entry["name"],
                "type": entry.get("type", "huggingface"),
                "models": models,
            }
            if entry.get("label"):
                provider_entry["label"] = entry["label"]
            providers.append(provider_entry)
        return {
            "providers": providers,
            "router": dict(self._router),
        }

    async def preload_model(self) -> None:
        """Preload the default music provider model."""
        try:
            provider = self.get_provider()
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
                "Music model preload failed (will retry on first generation)",
                exc_info=True,
            )
