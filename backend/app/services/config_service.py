import asyncio
import logging
import os
import re

from backend.app.core.config import load_raw_yaml_config, save_yaml_config
from backend.app.providers.manager import provider_manager

_ENV_VAR_RE = re.compile(r"\$\{(\w+)\}")

logger = logging.getLogger(__name__)


def _preserve_env_ref(new_value: str, original_raw: str | None) -> str:
    """Return *original_raw* if it contains ``${...}`` and resolves to *new_value*.

    This prevents overwriting env var references in ``config.yaml`` with
    their resolved values when the user hasn't actually changed them.
    """
    if not original_raw or not _ENV_VAR_RE.search(original_raw):
        return new_value

    # Resolve the original raw value and compare
    def _resolve(raw: str) -> str:
        return _ENV_VAR_RE.sub(
            lambda m: os.environ.get(m.group(1), ""), raw,
        )

    if _resolve(original_raw) == new_value:
        return original_raw
    return new_value


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
        # Resolve masked API keys before updating in-memory providers
        resolved_providers = []
        for p in providers:
            rp = dict(p)
            if self._is_masked_key(rp.get("api_key", "")):
                rp["api_key"] = self._resolve_api_key(rp["api_key"], rp.get("name", ""))
            resolved_providers.append(rp)

        provider_manager.update_llm_config(resolved_providers, router)

        raw_config = await asyncio.to_thread(load_raw_yaml_config)
        raw_config.setdefault("llm", {})

        # Build lookup of original raw entries so we can preserve ${...}
        # env var references when the resolved value hasn't changed.
        orig_by_name: dict[str, dict] = {}
        for orig in raw_config.get("llm", {}).get("providers", []):
            orig_by_name[orig.get("name", "")] = orig

        yaml_providers = []
        for rp in resolved_providers:
            entry: dict = {"name": rp["name"]}
            ptype = rp.get("type", rp["name"])
            if ptype != rp["name"]:
                entry["type"] = ptype
            if rp.get("base_url"):
                entry["base_url"] = _preserve_env_ref(
                    rp["base_url"],
                    orig_by_name.get(rp["name"], {}).get("base_url"),
                )
            if rp.get("api_key"):
                entry["api_key"] = _preserve_env_ref(
                    rp["api_key"],
                    orig_by_name.get(rp["name"], {}).get("api_key"),
                )
            if rp.get("models"):
                entry["models"] = rp["models"]
            yaml_providers.append(entry)

        raw_config["llm"]["providers"] = yaml_providers
        raw_config["llm"]["router"] = router
        await asyncio.to_thread(save_yaml_config, raw_config)

        return provider_manager.get_llm_config()

    @staticmethod
    def _is_masked_key(key: str) -> bool:
        """Return True if the key is a masked placeholder (e.g. ``sk-...xxxx``)."""
        return (bool(key) and key.startswith("sk-...")) or key == "****"

    def _resolve_api_key(self, api_key: str, provider_name: str) -> str:
        """If the api_key is masked, look up the real key from loaded providers."""
        if not self._is_masked_key(api_key):
            return api_key
        if not provider_name:
            return api_key
        provider_obj = provider_manager._llm.providers.get(provider_name)
        if provider_obj and provider_obj.config.api_key:
            return provider_obj.config.api_key
        return api_key

    async def test_llm_connection(
        self,
        provider_type: str,
        base_url: str,
        api_key: str,
        model: str,
        provider_name: str = "",
    ) -> dict:
        """Test an LLM provider connection via init_chat_model."""
        from langchain.chat_models import init_chat_model
        from langchain_core.messages import HumanMessage

        # Resolve masked API keys back to the real value
        api_key = self._resolve_api_key(api_key, provider_name)

        lc_provider = (
            "openai"
            if provider_type in ("openrouter", "openai_compat")
            else provider_type
        )

        try:
            if not model:
                raise ValueError("A model name is required for connection testing")
            test_model = model
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
        return await provider_manager.list_music_providers()

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
