import logging

from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import StyleSuggestion

logger = logging.getLogger(__name__)


class LLMService:
    """Domain service wrapping all LLM provider calls.

    API endpoints call this service instead of touching providers directly.
    """

    async def generate_lyrics(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
        language: str = "en",
    ) -> str:
        provider, model = provider_manager.get_llm_provider("lyrics")
        return await provider.generate_lyrics(
            prompt, model, genre=genre, mood=mood, language=language
        )

    async def enhance_prompt(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
    ) -> str:
        provider, model = provider_manager.get_llm_provider("enhancement")
        return await provider.enhance_prompt(prompt, model, genre=genre, mood=mood)

    async def suggest_style(self, prompt: str) -> StyleSuggestion:
        provider, model = provider_manager.get_llm_provider("suggestion")
        raw = await provider.suggest_style(prompt, model)
        return StyleSuggestion(**raw)

    async def generate_title(
        self,
        lyrics: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        prompt: str | None = None,
    ) -> str:
        provider, model = provider_manager.get_llm_provider("suggestion")
        return await provider.generate_title(
            model=model, lyrics=lyrics, genre=genre, mood=mood, prompt=prompt
        )

    async def generate_cover_prompt(
        self,
        title: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
    ) -> str:
        provider, model = provider_manager.get_llm_provider("cover_art")
        return await provider.generate_cover_prompt(
            model=model, title=title, genre=genre, mood=mood, lyrics=lyrics
        )


llm_service = LLMService()
