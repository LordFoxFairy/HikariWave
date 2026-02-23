import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from backend.app.providers.llm.base import (
    LYRICS_SYSTEM_PROMPT,
    PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
    STYLE_SUGGESTION_SYSTEM_PROMPT,
    BaseLLMProvider,
)

logger = logging.getLogger(__name__)


class OpenRouterProvider(BaseLLMProvider):
    def _get_chat_model(self, model: str) -> ChatOpenAI:
        return ChatOpenAI(
            model=model,
            openai_api_key=self.config.api_key,
            openai_api_base=self.config.base_url,
            temperature=0.8,
            max_tokens=2048,
        )

    async def generate_lyrics(
        self,
        prompt: str,
        model: str,
        genre: str | None = None,
        mood: str | None = None,
        language: str = "en",
    ) -> str:
        llm = self._get_chat_model(model)
        user_content = f"Write song lyrics about: {prompt}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        user_content += f"\nLanguage: {language}"
        messages = [
            SystemMessage(content=LYRICS_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
        response = await llm.ainvoke(messages)
        return response.content

    async def enhance_prompt(
        self,
        prompt: str,
        model: str,
        genre: str | None = None,
        mood: str | None = None,
    ) -> str:
        llm = self._get_chat_model(model)
        user_content = f"Enhance this music description: {prompt}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        messages = [
            SystemMessage(content=PROMPT_ENHANCEMENT_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
        response = await llm.ainvoke(messages)
        return response.content

    async def suggest_style(self, prompt: str, model: str) -> dict:
        llm = self._get_chat_model(model)
        messages = [
            SystemMessage(content=STYLE_SUGGESTION_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
        response = await llm.ainvoke(messages)
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return {"raw": response.content}

    async def health_check(self) -> bool:
        try:
            llm = self._get_chat_model(self.config.models[0])
            await llm.ainvoke([HumanMessage(content="ping")])
            return True
        except Exception:
            logger.exception("OpenRouter health check failed")
            return False
