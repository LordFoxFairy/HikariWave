import asyncio
import logging

from backend.app.core.config import load_raw_yaml_config, save_yaml_config
from backend.app.providers.llm.ollama import detect_ollama, list_ollama_models
from backend.app.providers.manager import provider_manager

logger = logging.getLogger(__name__)


class ProviderService:
    """Thin wrapper around provider_manager for listing providers.

    API endpoints call this service instead of importing provider_manager directly.
    """

    async def list_llm_providers(self) -> list[dict]:
        return provider_manager.list_llm_providers()

    async def list_music_providers(self) -> list[dict]:
        return provider_manager.list_music_providers()

    async def list_image_providers(self) -> list[dict]:
        return provider_manager.list_image_providers()

    async def get_llm_config(self) -> dict:
        return provider_manager.get_llm_config()

    async def get_music_config(self) -> dict:
        return provider_manager.get_music_config()

    async def update_music_config(
            self, providers: list[dict], router: dict[str, str],
    ) -> dict:
        """Update music config in memory and persist to config.yaml."""
        provider_manager.update_music_config(providers, router)

        # Persist to config.yaml
        raw_config = await asyncio.to_thread(load_raw_yaml_config)
        raw_config.setdefault("music", {})

        yaml_providers = []
        for p in providers:
            entry: dict = {"name": p["name"]}
            ptype = p.get("type", "huggingface")
            entry["type"] = ptype
            if p.get("models"):
                entry["models"] = p["models"]
            yaml_providers.append(entry)

        raw_config["music"]["providers"] = yaml_providers
        raw_config["music"]["router"] = router
        await asyncio.to_thread(save_yaml_config, raw_config)

        return provider_manager.get_music_config()

    async def update_llm_config(
            self, providers: list[dict], router: dict[str, str],
    ) -> dict:
        """Update LLM config in memory and persist to config.yaml."""
        # Update in-memory state
        provider_manager.update_llm_config(providers, router)

        # Persist to config.yaml (raw, without resolved env vars)
        raw_config = await asyncio.to_thread(load_raw_yaml_config)
        raw_config.setdefault("llm", {})

        # Build provider entries for YAML
        yaml_providers = []
        for p in providers:
            entry: dict = {"name": p["name"]}
            ptype = p.get("type", p["name"])
            if ptype != p["name"]:
                entry["type"] = ptype
            if p.get("base_url"):
                entry["base_url"] = p["base_url"]
            if p.get("api_key"):
                entry["api_key"] = p["api_key"]
            if p.get("models"):
                entry["models"] = p["models"]
            yaml_providers.append(entry)

        raw_config["llm"]["providers"] = yaml_providers
        raw_config["llm"]["router"] = router
        await asyncio.to_thread(save_yaml_config, raw_config)

        return provider_manager.get_llm_config()

    async def test_llm_connection(
            self, provider_type: str, base_url: str, api_key: str, model: str
    ) -> dict:
        """Test an LLM provider connection."""
        if provider_type == "ollama":
            available = await detect_ollama(base_url)
            if not available:
                return {
                    "success": False,
                    "message": f"Ollama not reachable at {base_url}",
                    "models": [],
                }
            models = await list_ollama_models(base_url)
            return {
                "success": True,
                "message": f"Connected to Ollama, {len(models)} model(s) available",
                "models": models,
            }

        # For OpenRouter / OpenAI-compatible: try a simple completion
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import HumanMessage

        try:
            test_model = model or "gpt-3.5-turbo"
            llm = init_chat_model(
                test_model,
                model_provider="openai",
                api_key=api_key or "no-key",
                base_url=base_url,
                temperature=0,
                max_tokens=5,
            )
            await llm.ainvoke([HumanMessage(content="ping")])
        except Exception as e:
            logger.warning("LLM connection test failed: %s", e)
            return {
                "success": False,
                "message": f"Connection failed: {e!s}",
                "models": [],
            }
        else:
            return {
                "success": True,
                "message": "Connection successful",
                "models": [],
            }

    async def detect_ollama(self, base_url: str = "http://localhost:11434") -> dict:
        """Detect Ollama and list available models."""
        available = await detect_ollama(base_url)
        models: list[str] = []
        if available:
            models = await list_ollama_models(base_url)
        return {"available": available, "models": models}


provider_service = ProviderService()
