import asyncio
import logging

from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class LLMProviderConfig(BaseModel):
    name: str
    provider_type: str = "openai"
    label: str = Field(
        default="",
        description="Optional label to select a variant within the same provider type",
    )
    base_url: str = ""
    api_key: str = ""
    models: list[str] = Field(default_factory=list)


class LLMProvider:
    """Unified LLM model provider.

    A provider is a **model supplier** — it only manages connection config
    and model lifecycle via LangChain's ``init_chat_model``.  It does NOT
    contain any business logic or domain methods.
    """

    def __init__(self, config: LLMProviderConfig):
        self.config = config
        self._model = None
        self._current_model_name: str | None = None

    @property
    def current_model_name(self) -> str | None:
        """The name of the currently loaded model, or ``None``."""
        return self._current_model_name

    async def init_model(self, model: str, **kwargs) -> None:
        """Create the model client via LangChain's init_chat_model."""
        init_kwargs: dict = {}
        if self.config.api_key:
            init_kwargs["api_key"] = self.config.api_key
        if self.config.base_url:
            init_kwargs["base_url"] = self.config.base_url

        self._model = await asyncio.to_thread(
            init_chat_model,
            model,
            model_provider=self.config.provider_type,
            **init_kwargs,
        )
        self._current_model_name = model
        logger.info(
            "LLM model initialised: %s (provider=%s)",
            model,
            self.config.provider_type,
        )

    async def health_check(self) -> bool:
        try:
            if not self.is_loaded:
                if not self.config.models:
                    logger.warning("No models configured for provider %s", self.config.name)
                    return False
                await self.init_model(self.config.models[0])
            await self._model.ainvoke([HumanMessage(content="ping")])
        except Exception:
            logger.exception("LLM health check failed (%s)", self.config.name)
            return False
        else:
            return True

    @property
    def model(self):
        """Return the initialised model client."""
        return self._model

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    async def unload_model(self) -> None:
        self._model = None
        self._current_model_name = None
