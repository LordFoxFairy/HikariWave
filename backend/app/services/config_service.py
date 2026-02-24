import asyncio
import logging

from backend.app.core.config import load_raw_yaml_config, save_yaml_config
from backend.app.providers.manager import provider_manager

logger = logging.getLogger(__name__)


class ProviderConfigService:
    """Manages provider configuration: list, read, update, persist.

    API endpoints call this service for config CRUD instead of
    importing provider_manager directly.
    """

    # -- LLM --

    async def list_llm_providers(self) -> list[dict]:
        return provider_manager.list_llm_providers()

    async def get_llm_config(self) -> dict:
        return provider_manager.get_llm_config()

    async def update_llm_config(
        self,
        providers: list[dict],
        router: dict[str, str],
    ) -> dict:
        provider_manager.update_llm_config(providers, router)

        raw_config = await asyncio.to_thread(load_raw_yaml_config)
        raw_config.setdefault("llm", {})

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
        self,
        provider_type: str,
        base_url: str,
        api_key: str,
        model: str,
    ) -> dict:
        """Test an LLM provider connection via init_chat_model."""
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import HumanMessage

        lc_provider = (
            "openai"
            if provider_type in ("openrouter", "openai_compat")
            else provider_type
        )

        try:
            test_model = model or "gpt-3.5-turbo"
            init_kwargs: dict = {
                "temperature": 0,
                "max_tokens": 5,
            }
            if api_key:
                init_kwargs["api_key"] = api_key
            if base_url:
                init_kwargs["base_url"] = base_url
            llm = init_chat_model(
                test_model,
                model_provider=lc_provider,
                **init_kwargs,
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

    # -- Music --

    async def list_music_providers(self) -> list[dict]:
        return provider_manager.list_music_providers()

    async def get_music_config(self) -> dict:
        return provider_manager.get_music_config()

    async def update_music_config(
        self,
        providers: list[dict],
        router: dict[str, str],
    ) -> dict:
        provider_manager.update_music_config(providers, router)

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


provider_config_service = ProviderConfigService()
