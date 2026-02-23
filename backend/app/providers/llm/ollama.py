import json
import logging

import httpx
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

OLLAMA_DEFAULT_URL = "http://localhost:11434"


async def detect_ollama(base_url: str = OLLAMA_DEFAULT_URL) -> bool:
    """Check if Ollama is running at the given URL."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def list_ollama_models(base_url: str = OLLAMA_DEFAULT_URL) -> list[str]:
    """List available models from a running Ollama instance."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            if resp.status_code != 200:
                return []
            data = resp.json()
            return [m["name"] for m in data.get("models", [])]
    except Exception:
        logger.exception("Failed to list Ollama models")
        return []


class OllamaProvider(BaseLLMProvider):
    """LLM provider backed by a local Ollama instance (OpenAI-compatible API)."""

    def _get_chat_model(self, model: str, **kwargs) -> ChatOpenAI:
        # Ollama exposes an OpenAI-compatible endpoint at /v1
        return ChatOpenAI(
            model=model,
            openai_api_key="ollama",
            openai_api_base=f"{self.config.base_url}/v1",
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
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse style suggestion JSON, returning defaults")
            return dict(_STYLE_DEFAULTS)
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
        return response.content.strip().strip("\"'")

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
            return await detect_ollama(self.config.base_url)
        except Exception:
            logger.exception("Ollama health check failed")
            return False
