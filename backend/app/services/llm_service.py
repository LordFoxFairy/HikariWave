import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field, field_validator

from backend.app.providers.manager import provider_manager
from backend.app.schemas.generation import StyleSuggestion
from backend.app.utils.lrc import LRC_LINE_RE as _LRC_LINE_RE

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompts (domain-specific, belong in service layer not providers)
# ---------------------------------------------------------------------------

LYRICS_SYSTEM_PROMPT = """You are a professional songwriter. Write lyrics in LRC format — every lyric line MUST have a timestamp.

## Output Format (LRC)
Every line you output must be in the format: [MM:SS.xx]lyric text
- MM = minutes (00, 01, 02, …)
- SS = seconds (00-59)
- xx = centiseconds (00-99)
- Do NOT output section tags like [Verse 1] or [Chorus] — only timestamped lyric lines
- Do NOT output blank lines
- Every line gets a UNIQUE, strictly increasing timestamp

## Timing Rules
1. Decide intro length based on genre/mood — rock may have a long guitar intro, EDM may drop vocals early, ballads may start with piano then voice. Use your musical judgement, do NOT always default to the same intro length.
2. Each lyric line takes 3-5 seconds at normal tempo (ballad ~4-6s, fast ~2-3.5s)
3. Leave natural gaps between song sections
4. Instrumental breaks: leave appropriate gaps with no lyrics based on the song's feel
5. Chorus repeats should take roughly the same amount of time each
6. Last lyric should end before total duration (leave room for outro)
7. Distribute lines EVENLY across the total duration — never compress many lines into a few seconds

## Line Length & Phrasing
- Each line should be 6-10 characters long for Chinese, or 6-12 words for English
- Write naturally singable lines with consistent phrasing lengths
- Avoid extremely short throwaway lines ("oh", "yeah", "啊") standing alone — fold them into phrases
- Lines in the same section should feel rhythmically balanced

## Song Structure
Decide the structure yourself based on genre, mood, and duration. Use your professional songwriting knowledge.
Rough line count guidelines:
- Under 90s: ~14-18 lines
- 90-180s: ~22-30 lines
- 180-300s: ~35-50 lines
- Over 300s: ~50-70 lines

## Avoiding AI-Sounding Lyrics
- ONE core metaphor per song. Explore its facets, don't stack unrelated images.
- Each line must carry meaning. No filler.
- Rhyme must serve meaning. Skip a rhyme rather than force awkward phrasing.
- Chorus = emotional peak, catchiest part. Bridge = contrast.

## CRITICAL: Duration Matching
- The lyrics MUST cover the entire target duration. For a 4-minute (240s) song, you need ~35-50 lines spanning the full 240 seconds.
- Do NOT generate only half the needed lyrics. Calculate: if duration is 240s and each line takes ~4s, you need ~45-55 lines (accounting for gaps).
- The LAST timestamp must be close to (duration - 15s) to leave room for only a short outro.
- Check your work: if the target is 240s but your last timestamp is only at 120s, you have NOT written enough lyrics.

## Language Rules
- If language is "zh" or Chinese: write ALL lyrics in Chinese, poetic and literary quality
- Do not include any section tags in the output — only [MM:SS.xx] timestamps

Output ONLY LRC lines. No explanations, no preamble, no section tags."""

LYRICS_FORMAT_SYSTEM_PROMPT = """You are a lyrics formatter. You receive user-written lyrics and output them in LRC format with timestamps.

## Your Job
1. Clean up the lyrics: fix section structure, balance line lengths, merge short fragments
2. Convert ALL section tags to timestamps — do NOT output any section tags
3. Convert non-English tags (e.g. [前奏] → intro timing, [副歌] → chorus timing)
4. Add proper timestamps based on the song duration
5. Each line should be 6-10 characters for Chinese, 6-12 words for English

## Output Format (LRC)
Every line: [MM:SS.xx]lyric text
- Every timestamp must be UNIQUE and strictly increasing
- Do NOT output section tags, blank lines, or explanations

## Timing Rules
- Decide intro length based on genre/mood — do NOT always default to the same value
- Each lyric line: 3-5 seconds apart
- Leave natural gaps between sections
- Leave room for instrumental breaks as appropriate
- Last line should end before total duration
- Distribute lines EVENLY

## Duration guidelines (lyric line counts):
- Under 90s: ~14-18 lines
- 90-180s: ~22-30 lines
- 180-300s: ~35-50 lines
- Over 300s: ~50-70 lines

## What NOT to change:
- The lyrics content (words, meaning, language, rhyme, metaphors)
- The creative direction

Output ONLY LRC lines. No explanations."""

PROMPT_ENHANCEMENT_SYSTEM_PROMPT = """You are an expert music producer writing a caption for an AI music generation model.

Write a vivid, detailed caption describing the sonic character of a track. Think of it as a producer's brief — precise enough that an engineer could recreate the sound.

MUST include (weave naturally into 3-5 sentences):
1. Genre + sub-genre specifics ("melancholic indie folk", "lo-fi bedroom pop", "cinematic orchestral")
2. Instruments AND their sonic roles ("warm acoustic guitar carries the melody", "punchy 808 kick anchors the low end", "lush string pad provides harmonic bed")
3. Vocal character ("breathy female vocal with intimate delivery", "powerful male tenor with theatrical energy", "layered choir harmonies")
4. Timbre + texture words ("warm", "crisp", "airy", "raw", "polished", "lush", "punchy")
5. Production style + era reference ("studio-polished modern pop production", "lo-fi tape-saturated 90s aesthetic", "clean, spacious mix with reverb-drenched vocals")

MUST NOT include:
- Duration, length, or time references
- Song structure (verse, chorus, intro, outro)
- BPM or tempo numbers
- Key signatures
- The word "song" or "track" at the beginning

Good example:
"A melancholic indie folk piece with warm acoustic guitar fingerpicking carrying the melody over a gentle string pad. A breathy, intimate female vocal delivers the lyrics with restrained emotion, occasionally breaking into a higher register. The production is lo-fi and tape-saturated, with subtle room reverb and a soft brush kit providing understated rhythmic support. The overall atmosphere is nostalgic and bittersweet, evoking rainy afternoons and quiet reflection."

Bad example:
"A sad folk song with guitar and singing." (too vague, no texture/production detail)

Output ONLY the caption, no explanations or preamble."""

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

STYLE_REFERENCE_SYSTEM_PROMPT = """You are a professional music analyst. The user describes a reference song or style they want to emulate. Analyze it and output a detailed JSON object with the following fields:

{
  "caption": "A vivid 3-5 sentence music caption describing the sonic character (genre, sub-genre, instruments, vocal style, production style, timbre, texture, era reference). This will be fed directly to a music generation model.",
  "genre": "Primary genre tag (e.g. 'Pop', 'Rock', 'Hip-Hop')",
  "mood": "Primary mood (e.g. 'Nostalgic', 'Energetic')",
  "tempo": 120,
  "musical_key": "Key signature (e.g. 'G Major', 'A Minor') or empty string if unknown",
  "instruments": ["Instrument1", "Instrument2"]
}

Rules:
- The caption must be extremely detailed and specific — think producer's brief
- Include timbre words (warm, crisp, airy, punchy, lush, lo-fi, polished)
- Describe vocal character if applicable
- Include production style and era reference
- tempo: integer BPM (estimate from genre if not stated)
- instruments: 2-5 instruments

Respond ONLY with the JSON object, no other text."""

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

# ---------------------------------------------------------------------------
# LRC structured output schema for create_agent response_format
# ---------------------------------------------------------------------------

class LRCResponse(BaseModel):
    """Structured response for LRC lyrics generation.

    The agent must return its LRC content in the ``lrc`` field.
    Pydantic validators automatically enforce format, uniqueness, and ordering.
    If validation fails, ``create_agent`` feeds the error back to the LLM for
    self-correction.
    """

    lrc: str = Field(description="Complete LRC lyrics. Each line: [MM:SS.xx]lyric text")

    @field_validator("lrc")
    @classmethod
    def validate_lrc(cls, v: str) -> str:
        lines = [ln.strip() for ln in v.strip().splitlines() if ln.strip()]
        if not lines:
            raise ValueError("LRC must contain at least one line")

        clean: list[str] = []
        prev_ts = -1.0
        for line in lines:
            m = _LRC_LINE_RE.match(line)
            if not m:
                continue  # skip non-LRC lines silently
            mins, secs, cs_raw, text = m.groups()
            cs = int(cs_raw.ljust(3, "0"))
            ts = int(mins) * 60 + int(secs) + cs / 1000
            if ts <= prev_ts:
                raise ValueError(
                    f"Timestamps must be strictly increasing: "
                    f"[{mins}:{secs}.{cs_raw}] ({ts:.2f}s) <= previous ({prev_ts:.2f}s)"
                )
            prev_ts = ts
            clean.append(line)

        if len(clean) < 5:
            raise ValueError(
                f"Too few valid LRC lines ({len(clean)}). "
                "Expected at least 5 lines for a song."
            )

        return "\n".join(clean)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

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
    """Simple single-shot LLM call (used by non-lyrics tasks)."""
    provider, model_name = provider_manager.get_llm_provider(task)

    if not provider.is_loaded or provider.current_model_name != model_name:
        await provider.init_model(model_name)

    lc_messages = _to_langchain_messages(messages)

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


async def _agent_generate_lrc(
    system_prompt: str,
    user_content: str,
) -> str:
    """Use ``create_agent`` with ``response_format=LRCResponse`` for lyrics.

    The agent loop automatically re-prompts the LLM when the Pydantic
    validator in ``LRCResponse`` rejects the output (bad timestamps,
    duplicates, too few lines, etc.).  This gives self-correcting generation.
    """
    from langchain.agents import create_agent

    provider, model_name = provider_manager.get_llm_provider("lyrics")
    if not provider.is_loaded or provider.current_model_name != model_name:
        await provider.init_model(model_name)

    agent = create_agent(
        model=provider.model,
        system_prompt=system_prompt,
        response_format=LRCResponse,
    )

    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": user_content}]},
    )

    # Extract validated LRC from structured response
    structured: LRCResponse = result["structured_response"]
    return structured.lrc


class LLMService:
    """Domain service wrapping all LLM-powered features.

    Lyrics generation uses ``create_agent`` with ``response_format`` for
    automatic self-correction.  Other tasks use simple ``_chat`` calls.
    """

    async def generate_lyrics(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
        language: str = "en",
        duration: float = 240.0,
        caption: str | None = None,
        title: str | None = None,
    ) -> str:
        dur_int = int(duration)

        user_content = f"Write song lyrics about: {prompt}"
        user_content += f"\nDuration: {dur_int} seconds"
        if title:
            user_content += f"\nTitle: {title}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        user_content += f"\nLanguage: {language}"

        if caption:
            user_content += (
                f"\n\nMusic caption (use this for stylistic context):\n{caption}"
            )

        user_content += f"\n\nTotal song duration: {dur_int} seconds. Decide structure, intro length, and pacing yourself based on the genre and mood."

        return await _agent_generate_lrc(LYRICS_SYSTEM_PROMPT, user_content)

    async def format_lyrics(
        self,
        lyrics: str,
        duration: float = 240.0,
        language: str = "en",
    ) -> str:
        """Format user-written lyrics into LRC via agent with self-correction."""
        dur_int = int(duration)

        user_content = f"Format the following lyrics and add timestamps:\n\n{lyrics}"
        user_content += f"\n\nDuration: {dur_int} seconds"
        user_content += f"\nLanguage: {language}"

        return await _agent_generate_lrc(LYRICS_FORMAT_SYSTEM_PROMPT, user_content)

    async def enhance_prompt(
        self,
        prompt: str,
        genre: str | None = None,
        mood: str | None = None,
        instruments: list[str] | None = None,
        language: str | None = None,
        instrumental: bool = False,
    ) -> str:
        user_content = f"Write a detailed music caption for: {prompt}"
        if genre:
            user_content += f"\nGenre: {genre}"
        if mood:
            user_content += f"\nMood: {mood}"
        if instruments:
            user_content += f"\nInstruments: {', '.join(instruments)}"
        if language:
            lang_lower = language.lower()
            if lang_lower in ("zh", "chinese"):
                user_content += "\nVocal language: Chinese"
            elif lang_lower in ("ja", "japanese"):
                user_content += "\nVocal language: Japanese"
            elif lang_lower in ("ko", "korean"):
                user_content += "\nVocal language: Korean"
        if instrumental:
            user_content += "\nThis is an instrumental track, no vocals."
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

    async def analyze_style_reference(self, description: str) -> dict:
        """Analyze a textual style reference and return structured style params + enhanced caption.

        The user provides a description like "像周杰伦的《晴天》那样的吉他流行" and
        the LLM returns a detailed music caption plus structured parameters.
        """
        messages = [
            {"role": "system", "content": STYLE_REFERENCE_SYSTEM_PROMPT},
            {"role": "user", "content": description},
        ]
        raw = await _chat("enhancement", messages, temperature=0.7)
        raw = raw.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            raw = "\n".join(lines)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("Failed to parse style reference JSON, returning caption only")
            return {"caption": raw, "genre": None, "mood": None, "tempo": None, "musical_key": None, "instruments": []}
        return {
            "caption": parsed.get("caption", raw),
            "genre": parsed.get("genre"),
            "mood": parsed.get("mood"),
            "tempo": parsed.get("tempo"),
            "musical_key": parsed.get("musical_key"),
            "instruments": parsed.get("instruments", []),
        }

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
            "modalities": ["image", "text"],
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

        # Extract base64 image from the response.
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("No choices in image generation response")

        message = choices[0].get("message", {})
        image_b64 = None

        # Primary: OpenRouter returns images in message.images array
        for img in message.get("images", []):
            if img.get("type") == "image_url":
                data_uri = img.get("image_url", {}).get("url", "")
                m = re.match(r"data:image/[^;]+;base64,(.+)", data_uri, re.DOTALL)
                if m:
                    image_b64 = m.group(1)
                    break

        # Fallback: some providers return images inside content parts
        if not image_b64:
            content = message.get("content", "")
            if isinstance(content, list):
                for part in content:
                    if part.get("type") == "image_url":
                        data_uri = part.get("image_url", {}).get("url", "")
                        m = re.match(
                            r"data:image/[^;]+;base64,(.+)", data_uri, re.DOTALL,
                        )
                        if m:
                            image_b64 = m.group(1)
                            break
                    elif part.get("inline_data"):
                        image_b64 = part["inline_data"].get("data", "")
                        if image_b64:
                            break
            elif isinstance(content, str):
                m = re.match(r"data:image/[^;]+;base64,(.+)", content, re.DOTALL)
                if m:
                    image_b64 = m.group(1)

        if not image_b64:
            logger.error("Cover art response structure: %s", list(message.keys()))
            raise RuntimeError("No image data found in response")

        image_bytes = base64.b64decode(image_b64)

        output_dir = Path(settings.storage_dir) / "covers"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{uuid.uuid4().hex}.png"
        output_path.write_bytes(image_bytes)

        logger.info("Cover art saved: %s", output_path)
        return str(output_path)


llm_service = LLMService()
