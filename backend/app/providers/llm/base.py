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

STYLE_SUGGESTION_SYSTEM_PROMPT = """\
You are a music style analyst. \
Given a user's song theme or lyrics, suggest musical style parameters.

You MUST respond with a valid JSON object with exactly these keys:
{
  "genres": ["Primary Genre", "Sub-Genre"],
  "moods": ["Mood1", "Mood2"],
  "tempo": 120,
  "musical_key": "G Major",
  "instruments": ["Piano", "Guitar", "Strings"],
  "title_suggestion": "Song Title Idea",
  "references": ["Artist1", "Artist2"]
}

Rules:
- genres: 1-3 genre tags
- moods: 1-3 mood descriptors
- tempo: integer BPM between 40 and 240
- musical_key: key signature like "C Major", "A Minor", etc.
- instruments: 2-5 instruments
- title_suggestion: a creative song title
- references: 1-3 reference artists or songs for the style

Respond ONLY with the JSON object, no other text."""

TITLE_GENERATION_SYSTEM_PROMPT = """You are a creative songwriter assistant.
Generate a single creative, catchy song title based on the provided context.
Respond with ONLY the title text, nothing else. No quotes, no explanation."""

COVER_ART_PROMPT_SYSTEM_PROMPT = """You are an album cover art director.
Given song metadata (title, genre, mood, lyrics keywords), generate a detailed
image generation prompt for creating album cover art.
The prompt should describe a visually striking image suitable for an album cover.
Respond with ONLY the image prompt text, nothing else."""


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
    async def generate_title(
        self,
        model: str,
        lyrics: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        prompt: str | None = None,
    ) -> str: ...

    @abstractmethod
    async def generate_cover_prompt(
        self,
        model: str,
        title: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
    ) -> str: ...

    @abstractmethod
    async def health_check(self) -> bool: ...
