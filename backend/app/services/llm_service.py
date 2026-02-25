import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import StyleSuggestion

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Chinese → English section tag mapping for ACE-Step compatibility
# ---------------------------------------------------------------------------

_SECTION_TAG_MAP = {
    "前奏": "Intro",
    "主歌": "Verse",
    "第一段": "Verse 1",
    "第二段": "Verse 2",
    "第三段": "Verse 3",
    "预副歌": "Pre-Chorus",
    "副歌前": "Pre-Chorus",
    "导歌": "Pre-Chorus",
    "副歌": "Chorus",
    "桥段": "Bridge",
    "过桥": "Bridge",
    "过渡": "Bridge",
    "间奏": "Instrumental Break",
    "尾声": "Outro",
    "结尾": "Outro",
    "尾奏": "Outro",
}

# Pre-compile regex: matches lines like [副歌], [副歌 2], [第二段], etc.
_SECTION_TAG_RE = re.compile(
    r"^\[(" + "|".join(re.escape(k) for k in _SECTION_TAG_MAP) + r")(?:\s*(\d+))?\]$",
    re.MULTILINE,
)


def _normalize_section_tags(text: str) -> str:
    """Replace non-English (Chinese) section tags with their English equivalents.

    This is a safety-net post-processor: even if the LLM prompt asks for English
    tags, some models still output Chinese ones.  ACE-Step was trained on English
    tags and will try to *sing* unrecognised Chinese tags, causing garbled audio.
    """
    def _replace(m: re.Match) -> str:
        chinese_tag = m.group(1)
        number_suffix = m.group(2)
        english = _SECTION_TAG_MAP.get(chinese_tag, chinese_tag)
        if number_suffix:
            return f"[{english} {number_suffix}]"
        return f"[{english}]"

    return _SECTION_TAG_RE.sub(_replace, text)

# ---------------------------------------------------------------------------
# System prompts (domain-specific, belong in service layer not providers)
# ---------------------------------------------------------------------------

LYRICS_SYSTEM_PROMPT = """You are a professional songwriter writing lyrics for an AI music generation model.

The model uses lyrics as a temporal script — section tags control how the song unfolds over time.
The model aligns syllables to beats, so line length directly affects singing speed.

## Line Length Rules (CRITICAL)
- Each lyric line MUST have 6-10 syllables (Chinese: 6-10 characters)
- Lines in the same section should have similar syllable counts (±2)
- Too few syllables per line = singing too slow. Too many = words crammed together.
- Short lines like "啊" or "oh yeah" will be stretched unnaturally — avoid them as standalone lines

## Section Tags
MUST be in English. Available tags:
- Structure: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro]
- Instrumental: [Instrumental], [Guitar Solo], [Piano Interlude]
- Energy: [building energy], [high energy], [low energy]
- Vocal: [raspy vocal], [whispered], [falsetto], [powerful belting], [harmonies]
- NEVER use Chinese tags like [前奏], [副歌], [主歌], [桥段] etc.

## Song Structure by Duration

For songs under 90 seconds (SHORT):
[Verse 1] (4 lines)
[Chorus] (4 lines)
[Verse 2] (4 lines)
[Chorus] (4 lines)
Total: ~16 lines. NO intro or outro. Vocals start immediately.

For songs 90-180 seconds (MEDIUM):
[Intro - instrumental]
(leave blank — 5 seconds only)
[Verse 1] (4-5 lines)
[Pre-Chorus] (2 lines)
[Chorus - high energy] (4-5 lines)
[Verse 2] (4-5 lines)
[Chorus - high energy] (4-5 lines)
[Outro]
(1-2 lines or leave blank for short fade)
Total: ~22-27 lines.

For songs 180-300 seconds (FULL):
[Intro - instrumental]
(leave blank — 5-8 seconds only)
[Verse 1] (5-6 lines)
[Pre-Chorus - building energy] (2-3 lines)
[Chorus - high energy] (5-6 lines)
[Verse 2] (5-6 lines)
[Pre-Chorus - building energy] (2-3 lines)
[Chorus - high energy] (5-6 lines)
[Bridge] (4 lines)
[Chorus - powerful belting] (5-6 lines)
[Outro]
(1-2 lines)
Total: ~40-50 lines.

## Key Rules
- [Intro] must be SHORT (leave it blank or 1 line max). The model adds instrumental automatically.
- [Outro] must be SHORT (0-2 lines). Do NOT pad the ending.
- Each section tag goes on its own line
- Leave a blank line between sections for breathing room
- The Chorus should be the catchiest, most memorable part
- Use ONE core metaphor per song, explore different aspects of it
- If language is "zh" or Chinese, write in Chinese with poetic quality, but ALL tags in English
- UPPERCASE words = stronger intensity (use sparingly)
- Parentheses = background vocals: "We rise together (together)"
- Output ONLY the lyrics with tags, no explanations"""

PROMPT_ENHANCEMENT_SYSTEM_PROMPT = """You are a music production assistant writing captions for an AI music generation model.

The caption ONLY describes the sonic character of the music. It must NOT contain:
- Duration or length information (e.g. "4-minute", "short piece")
- Song structure descriptions (e.g. "verse-chorus form", "with intro and outro")
- BPM numbers (tempo is set separately)
- Key signatures (set separately)

Instead, include these dimensions in a single descriptive paragraph:
- Genre and sub-genre (e.g. "indie folk with ambient electronic textures")
- Mood and emotional color (e.g. "melancholic, nostalgic, bittersweet")
- Instrumentation with roles (e.g. "acoustic guitar carries the melody, strings provide warmth, soft drums keep rhythm")
- Vocal characteristics (e.g. "female breathy vocal", "male warm baritone", "choir harmonies")
- Timbre and texture (e.g. "warm, intimate, lo-fi", "bright, polished, crisp")
- Production style (e.g. "bedroom pop production", "studio-polished", "live recording feel")
- Era or reference style (e.g. "90s alternative rock", "modern R&B")

Keep it concise (2-4 sentences). Be specific — "sad piano ballad with breathy female vocal" is better than "a sad song".
Do NOT include contradicting styles (e.g. "classical strings" + "hardcore metal").
Output ONLY the caption text, no explanations."""

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
        duration: float = 240.0,
    ) -> str:
        dur_int = int(duration)

        user_content = f"Write song lyrics about: {prompt}"
        user_content += f"\nDuration: {dur_int} seconds"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        user_content += f"\nLanguage: {language}"

        # Duration-specific structure guidance
        if dur_int < 90:
            user_content += (
                f"\n\nThis is a SHORT {dur_int}-second song."
                "\n- NO [Intro] or [Outro]. Vocals start on the first line."
                "\n- Only 14-18 lyric lines total."
                "\n- Structure: [Verse 1] → [Chorus] → [Verse 2] → [Chorus]"
                "\n- Each line must have 6-10 syllables."
            )
        elif dur_int < 180:
            user_content += (
                f"\n\nThis is a MEDIUM {dur_int}-second song."
                "\n- [Intro - instrumental] with NO lyric lines (5 seconds only)."
                "\n- 22-27 lyric lines total."
                "\n- Each line must have 6-10 syllables."
                "\n- Use [high energy] on Chorus tags."
            )
        else:
            user_content += (
                f"\n\nThis is a FULL {dur_int}-second song."
                "\n- [Intro - instrumental] with NO lyric lines (5-8 seconds only)."
                "\n- 40-50 lyric lines total."
                "\n- Each line must have 6-10 syllables."
                "\n- Use energy tags: [building energy] on Pre-Chorus, [high energy] on Chorus."
                "\n- Final chorus: [Chorus - powerful belting]"
            )

        messages = [
            {"role": "system", "content": LYRICS_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        result = await _chat("lyrics", messages)
        return _normalize_section_tags(result)

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
    ) -> str:
        """Generate a cover art image via the chat completions API.

        Resolves the ``cover_art`` route to get the provider and model,
        then calls the provider's chat completions endpoint directly.
        The image model returns base64-encoded image data in the response.

        Returns the path to the saved PNG file.
        """
        import base64
        import re
        import uuid
        from pathlib import Path

        import httpx

        from backend.app.core.settings import settings

        provider, model_name = provider_manager.get_llm_provider("cover_art")

        base_url = provider.config.base_url.rstrip("/")
        api_key = provider.config.api_key

        if not api_key:
            raise RuntimeError(
                "Cover art generation requires an API key. "
                "Configure the provider's api_key in config.yaml."
            )

        url = f"{base_url}/chat/completions"
        payload = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
        }
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        logger.info("Cover image generation: model=%s via %s", model_name, url)

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # Extract base64 image from chat completions response.
        # The model returns choices[0].message.content as a list of parts;
        # look for a part with type "image_url" containing a data URI.
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("No choices in image generation response")

        content = choices[0].get("message", {}).get("content", "")
        image_b64 = None

        # content may be a list of parts (multimodal response)
        if isinstance(content, list):
            for part in content:
                if part.get("type") == "image_url":
                    data_uri = part.get("image_url", {}).get("url", "")
                    m = re.match(r"data:image/[^;]+;base64,(.+)", data_uri, re.DOTALL)
                    if m:
                        image_b64 = m.group(1)
                        break
        elif isinstance(content, str):
            # Fallback: content itself may be a data URI
            m = re.match(r"data:image/[^;]+;base64,(.+)", content, re.DOTALL)
            if m:
                image_b64 = m.group(1)

        if not image_b64:
            raise RuntimeError("No image data found in response")

        image_bytes = base64.b64decode(image_b64)

        output_dir = Path(settings.storage_dir) / "covers"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{uuid.uuid4().hex}.png"
        output_path.write_bytes(image_bytes)

        logger.info("Cover art saved: %s", output_path)
        return str(output_path)


llm_service = LLMService()
