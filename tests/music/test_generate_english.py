"""Generate two versions of a song: 1min short + 4min full, saved to storage."""

import asyncio
import yaml


CAPTION = (
    "upbeat synthpop, 128 BPM, G Major, bright synths, driving beat, "
    "euphoric female vocal, dance pop, polished studio production"
)

LYRICS_SHORT = """\
[Verse]
Walking through the neon streets at night
City lights are painting colors bright
Every heartbeat echoes in my soul
Music makes me feel alive and whole

[Chorus]
We are the light, we are the sound
Dancing on the edge, feet off the ground
Hold me close, don't let me fall
Together we can have it all
We are the light, we are the sound
"""

LYRICS_FULL = """\
[Verse 1]
Walking through the neon streets at night
City lights are painting colors bright
Every heartbeat echoes in my soul
Music makes me feel alive and whole

[Pre-Chorus]
Turn it up, don't let the silence win
Feel the rhythm underneath my skin

[Chorus]
We are the light, we are the sound
Dancing on the edge, feet off the ground
Hold me close, don't let me fall
Together we can have it all
We are the light, we are the sound

[Verse 2]
Strangers passing by with secret dreams
Nothing ever really what it seems
But tonight the world belongs to us
In this moment there's no need to rush

[Pre-Chorus]
Turn it up, don't let the silence win
Feel the rhythm underneath my skin

[Chorus]
We are the light, we are the sound
Dancing on the edge, feet off the ground
Hold me close, don't let me fall
Together we can have it all
We are the light, we are the sound

[Bridge]
When the morning comes and the stars fade away
I'll remember every word that you say
We were infinite, if only for tonight
Two hearts burning in the pale moonlight

[Chorus]
We are the light, we are the sound
Dancing on the edge, feet off the ground
Hold me close, don't let me fall
Together we can have it all
We are the light, we are the sound

[Outro]
La la la la la la la
We are the light
La la la la la la la
We are the sound
"""

TITLE = "We Are The Light"
GENRE = "Synthpop / Dance Pop"
MOOD = "euphoric, energetic"


async def main():
    with open("backend/config.yaml") as f:
        cfg = yaml.safe_load(f)

    from backend.app.providers.manager.music import MusicProviderManager
    from backend.app.providers.music.base import MusicGenerationRequest
    from backend.app.services.storage import storage_service

    mgr = MusicProviderManager()
    mgr.init(cfg)

    provider = mgr.get_provider()
    print(f"Provider: {provider.config.name} ({type(provider).__name__})")

    print("Loading model...")
    await provider.load_model()
    print("Model loaded.\n")

    metadata = {
        "title": TITLE,
        "artist": "HikariWave AI",
        "genre": GENRE,
        "comment": CAPTION,
        "album": "HikariWave Generations",
    }

    # --- Short version (1 min) ---
    print("=" * 60)
    print("Generating SHORT version (60s)...")
    print("=" * 60)
    req_short = MusicGenerationRequest(
        prompt=CAPTION,
        lyrics=LYRICS_SHORT,
        duration=60.0,
    )
    resp_short = await provider.generate(req_short)
    filename_short = await storage_service.save_audio_with_metadata(
        resp_short.audio_data,
        resp_short.format,
        {**metadata, "title": f"{TITLE} (Short)"},
    )
    size_short = len(resp_short.audio_data) / (1024 * 1024)
    print(
        f"SHORT done: {filename_short}, "
        f"{resp_short.sample_rate}Hz, {size_short:.1f}MB\n"
    )

    # --- Full version (4 min) ---
    print("=" * 60)
    print("Generating FULL version (240s)...")
    print("=" * 60)
    req_full = MusicGenerationRequest(
        prompt=CAPTION,
        lyrics=LYRICS_FULL,
        duration=240.0,
    )
    resp_full = await provider.generate(req_full)
    filename_full = await storage_service.save_audio_with_metadata(
        resp_full.audio_data,
        resp_full.format,
        {**metadata, "title": f"{TITLE} (Full)"},
    )
    size_full = len(resp_full.audio_data) / (1024 * 1024)
    print(
        f"FULL done: {filename_full}, "
        f"{resp_full.sample_rate}Hz, {size_full:.1f}MB\n"
    )

    print("=" * 60)
    print("Both versions saved to: backend/storage/audio/")
    print(f"  Short: {filename_short}")
    print(f"  Full:  {filename_full}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
