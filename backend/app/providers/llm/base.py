from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

LYRICS_SYSTEM_PROMPT = """You are a professional songwriter.
Generate song lyrics based on the user's request.
Output structured lyrics with clear [Verse], [Chorus], [Bridge] markers.
Match the requested genre, mood, and language.
Be creative but coherent."""

PROMPT_ENHANCEMENT_SYSTEM_PROMPT = """You are a music production assistant.
Given a brief user description, produce a detailed music generation prompt.
Include: genre, sub-genre, mood, tempo (BPM), key, instrumentation,
dynamics, and production style. Format as a single descriptive paragraph
optimized for AI music generation models."""

STYLE_SUGGESTION_SYSTEM_PROMPT = """Given a user's song theme or lyrics, suggest:
1. Primary genre and sub-genre
2. Tempo range (BPM)
3. Key signature
4. Core instruments
5. Reference artists/songs for style
Output as structured JSON."""


class LLMProviderConfig(BaseModel):
    name: str
    base_url: str
    api_key: str = ""
    models: list[str] = Field(default_factory=list)


class BaseLLMProvider(ABC):
    def __init__(self, config: LLMProviderConfig):
        self.config = config

    @abstractmethod
    async def generate_lyrics(
        self,
        prompt: str,
        model: str,
        genre: str | None = None,
        mood: str | None = None,
        language: str = "en",
    ) -> str: ...

    @abstractmethod
    async def enhance_prompt(
        self,
        prompt: str,
        model: str,
        genre: str | None = None,
        mood: str | None = None,
    ) -> str: ...

    @abstractmethod
    async def suggest_style(self, prompt: str, model: str) -> dict: ...

    @abstractmethod
    async def health_check(self) -> bool: ...
