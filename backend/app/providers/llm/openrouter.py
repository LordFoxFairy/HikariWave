import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from backend.app.providers.llm.base import (
    COVER_ART_PROMPT_SYSTEM_PROMPT,
    LYRICS_SYSTEM_PROMPT,
    PROMPT_ENHANCEMENT_SYSTEM_PROMPT,
    STYLE_SUGGESTION_SYSTEM_PROMPT,
    TITLE_GENERATION_SYSTEM_PROMPT,
    BaseLLMProvider,
)

logger = logging.getLogger(__name__)

_STYLE_DEFAULTS = {
    "genres": [],
    "moods": [],
    "tempo": None,
    "musical_key": None,
    "instruments": [],
    "title_suggestion": None,
    "references": [],
}


class OpenRouterProvider(BaseLLMProvider):
    def _get_chat_model(self, model: str, **kwargs) -> ChatOpenAI:
        return ChatOpenAI(
            model=model,
            openai_api_key=self.config.api_key,
            openai_api_base=self.config.base_url,
            temperature=kwargs.get("temperature", 0.8),
            max_tokens=kwargs.get("max_tokens", 2048),
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
        llm = self._get_chat_model(model, temperature=0.7)
        messages = [
            SystemMessage(content=STYLE_SUGGESTION_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
        response = await llm.ainvoke(messages)
        raw = response.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            # Remove first and last lines (``` markers)
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse style suggestion JSON, returning defaults")
            return dict(_STYLE_DEFAULTS)
        # Ensure all expected keys exist with correct types
        result = {}
        for key, default in _STYLE_DEFAULTS.items():
            val = parsed.get(key, default)
            if isinstance(default, list) and not isinstance(val, list):
                val = [val] if val else []
            result[key] = val
        return result

    async def generate_title(
        self,
        model: str,
        lyrics: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        prompt: str | None = None,
    ) -> str:
        llm = self._get_chat_model(model, temperature=0.9)
        parts = ["Generate a song title based on the following:"]
        if prompt:
            parts.append(f"Theme: {prompt}")
        if lyrics:
            # Truncate very long lyrics for the title generation
            parts.append(f"Lyrics:\n{lyrics[:500]}")
        if genre:
            parts.append(f"Genre: {genre}")
        if mood:
            parts.append(f"Mood: {mood}")
        user_content = "\n".join(parts)
        messages = [
            SystemMessage(content=TITLE_GENERATION_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
        response = await llm.ainvoke(messages)
        # Strip any surrounding quotes the LLM might add
        title = response.content.strip().strip("\"'")
        return title

    async def generate_cover_prompt(
        self,
        model: str,
        title: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
    ) -> str:
        llm = self._get_chat_model(model, temperature=0.8)
        parts = ["Generate an album cover art prompt for:"]
        if title:
            parts.append(f"Title: {title}")
        if genre:
            parts.append(f"Genre: {genre}")
        if mood:
            parts.append(f"Mood: {mood}")
        if lyrics:
            parts.append(f"Lyrics excerpt:\n{lyrics[:300]}")
        user_content = "\n".join(parts)
        messages = [
            SystemMessage(content=COVER_ART_PROMPT_SYSTEM_PROMPT),
            HumanMessage(content=user_content),
        ]
        response = await llm.ainvoke(messages)
        return response.content.strip()

    async def health_check(self) -> bool:
        try:
            llm = self._get_chat_model(self.config.models[0])
            await llm.ainvoke([HumanMessage(content="ping")])
            return True
        except Exception:
            logger.exception("OpenRouter health check failed")
            return False
