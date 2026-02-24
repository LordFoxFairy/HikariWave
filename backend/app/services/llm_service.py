import json
import logging

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import StyleSuggestion

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompts (domain-specific, belong in service layer not providers)
# ---------------------------------------------------------------------------

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

_STYLE_DEFAULTS = {
    "genres": [],
    "moods": [],
    "tempo": None,
    "musical_key": None,
    "instruments": [],
    "title_suggestion": None,
    "references": [],
}


def _to_langchain_messages(
    messages: list[dict[str, str]],
) -> list[SystemMessage | HumanMessage | AIMessage]:
    """Convert ``{"role": ..., "content": ...}`` dicts to LangChain."""
    mapping = {
        "system": SystemMessage,
        "user": HumanMessage,
        "assistant": AIMessage,
    }
    result = []
    for msg in messages:
        cls = mapping.get(msg["role"], HumanMessage)
        result.append(cls(content=msg["content"]))
    return result


async def _chat(
    task: str,
    messages: list[dict[str, str]],
    **kwargs,
) -> str:
    """Resolve provider via router, init model if needed, call ainvoke.

    This is the single point where the service layer talks to LLM providers.
    The provider only supplies the model client — all prompt construction and
    response parsing happens in the service methods.

    Per-request parameters (``temperature``, ``max_tokens``) are passed to
    ``ainvoke`` via the model's ``bind`` method so they apply to the current
    call without requiring re-initialisation.
    """
    provider, model_name = provider_manager.get_llm_provider(task)

    # Re-initialise if model name changed or not yet loaded
    if not provider.is_loaded or provider.current_model_name != model_name:
        await provider.init_model(model_name)

    lc_messages = _to_langchain_messages(messages)

    # Apply per-request overrides (temperature, max_tokens, etc.)
    invoke_kwargs = {}
    if "temperature" in kwargs:
        invoke_kwargs["temperature"] = kwargs["temperature"]
    if "max_tokens" in kwargs:
        invoke_kwargs["max_tokens"] = kwargs["max_tokens"]

    model = provider.model
    if invoke_kwargs:
        model = model.bind(**invoke_kwargs)

    response = await model.ainvoke(lc_messages)
    return response.content


class LLMService:
    """Domain service wrapping all LLM-powered features.

    This service owns the business logic: prompt construction, response parsing,
    and fallback handling.  Providers are used only as model suppliers — the
    service gets the initialised model and calls it directly.
    """

    async def generate_lyrics(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
        language: str = "en",
    ) -> str:
        user_content = f"Write song lyrics about: {prompt}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        user_content += f"\nLanguage: {language}"
        messages = [
            {"role": "system", "content": LYRICS_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        return await _chat("lyrics", messages)

    async def enhance_prompt(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
    ) -> str:
        user_content = f"Enhance this music description: {prompt}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        messages = [
            {"role": "system", "content": PROMPT_ENHANCEMENT_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        return await _chat("enhancement", messages)

    async def suggest_style(self, prompt: str) -> StyleSuggestion:
        messages = [
            {"role": "system", "content": STYLE_SUGGESTION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        raw = await _chat("suggestion", messages, temperature=0.7)
        raw = raw.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse style suggestion JSON, returning defaults")
            return StyleSuggestion(**_STYLE_DEFAULTS)
        # Ensure all expected keys exist with correct types
        result = {}
        for key, default in _STYLE_DEFAULTS.items():
            val = parsed.get(key, default)
            if isinstance(default, list) and not isinstance(val, list):
                val = [val] if val else []
            result[key] = val
        return StyleSuggestion(**result)

    async def generate_title(
        self,
        lyrics: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        prompt: str | None = None,
    ) -> str:
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
            {"role": "system", "content": TITLE_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        title = await _chat("suggestion", messages, temperature=0.9)
        return title.strip().strip("\"'")

    async def generate_cover_prompt(
        self,
        title: str | None = None,
        genre: str | None = None,
        mood: str | None = None,
        lyrics: str | None = None,
    ) -> str:
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
            {"role": "system", "content": COVER_ART_PROMPT_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        result = await _chat("cover_art", messages, temperature=0.8)
        return result.strip()

    async def generate_cover_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
    ) -> str:
        """Generate a cover art image via the LLM provider's image endpoint.

        Uses the ``cover_art`` router entry to resolve the provider, then
        calls the OpenAI-compatible ``/images/generations`` endpoint with
        the provider's credentials.

        Returns the path to the saved PNG file.
        """
        import base64
        import uuid
        from pathlib import Path

        import httpx

        from backend.app.core.settings import settings

        provider, model_name = provider_manager.get_llm_provider("cover_art")
        base_url = provider.config.base_url.rstrip("/")
        # Strip /chat/completions or /v1 suffix to get the root
        for suffix in ("/chat/completions", "/v1"):
            if base_url.endswith(suffix):
                base_url = base_url[: -len(suffix)]
        images_url = f"{base_url}/v1/images/generations"

        payload = {
            "model": model_name,
            "prompt": prompt,
            "n": 1,
            "size": f"{width}x{height}",
            "response_format": "b64_json",
        }
        headers = {
            "Content-Type": "application/json",
        }
        if provider.config.api_key:
            headers["Authorization"] = f"Bearer {provider.config.api_key}"

        logger.info("Cover image generation: model=%s", model_name)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(images_url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        image_b64 = data["data"][0]["b64_json"]
        image_bytes = base64.b64decode(image_b64)

        output_dir = Path(settings.storage_dir) / "covers"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{uuid.uuid4().hex}.png"
        output_path.write_bytes(image_bytes)

        logger.info("Cover art saved: %s", output_path)
        return str(output_path)


llm_service = LLMService()
