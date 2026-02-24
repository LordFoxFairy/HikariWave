import logging

from backend.app.providers.llm.base import LLMProvider, LLMProviderConfig

logger = logging.getLogger(__name__)


class LLMProviderManager:
    def __init__(self) -> None:
        self.providers: dict[str, LLMProvider] = {}
        self._router: dict[str, str] = {}

    def init(self, config: dict) -> None:
        # Clean up existing providers before re-initialising
        for name, p in list(self.providers.items()):
            try:
                # LLM providers are API-based; just drop references
                del p
            except Exception:
                logger.warning("Failed to clean up LLM provider %s", name, exc_info=True)
        self.providers.clear()
        for entry in config.get("llm", {}).get("providers", []):
            name = entry["name"]
            config_type = entry.get("type", name)
            # OpenRouter and generic OpenAI-compatible providers
            # use the "openai" LangChain adapter; everything else
            # maps directly (e.g. "ollama" -> "ollama").
            lc_provider = (
                "openai"
                if config_type in ("openrouter", "openai_compat")
                else config_type
            )
            cfg = LLMProviderConfig(
                name=name,
                provider_type=lc_provider,
                label=entry.get("label", ""),
                base_url=entry.get("base_url", ""),
                api_key=entry.get("api_key", ""),
                models=entry.get("models", []),
            )
            self.providers[name] = LLMProvider(cfg)
        self._router = config.get("llm", {}).get("router", {})

    def _parse_route(self, route: str) -> tuple[str, str]:
        parts = route.split(":", 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return parts[0], ""

    def get_provider(self, task: str = "default") -> tuple[LLMProvider, str]:
        route = self._router.get(task, self._router.get("default", ""))
        provider_name, model = self._parse_route(route)
        provider = self.providers.get(provider_name)
        if provider is None:
            raise RuntimeError(f"LLM provider not found: {provider_name}")
        return provider, model

    def list_providers(self) -> list[dict]:
        result = []
        for name, p in self.providers.items():
            result.append(
                {
                    "name": name,
                    "provider_type": "api",
                    "label": p.config.label,
                    "models": p.config.models,
                    "is_active": self._router.get("default", "").startswith(name + ":"),
                }
            )
        return result

    @staticmethod
    def _mask_api_key(key: str) -> str:
        """Mask an API key, showing only the last 4 characters."""
        if not key:
            return ""
        if len(key) <= 4:
            return "****"
        return f"sk-...{key[-4:]}"

    def get_config(self, full_config: dict) -> dict:
        """Return the full LLM configuration: providers + router."""
        providers = []
        for entry in full_config.get("llm", {}).get("providers", []):
            provider_entry: dict = {
                "name": entry["name"],
                "type": entry.get("type", entry["name"]),
                "base_url": entry.get("base_url", ""),
                "api_key": self._mask_api_key(entry.get("api_key", "")),
                "models": entry.get("models", []),
            }
            if entry.get("label"):
                provider_entry["label"] = entry["label"]
            providers.append(provider_entry)
        return {
            "providers": providers,
            "router": dict(self._router),
        }
