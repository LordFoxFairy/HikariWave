"""Generate a Chinese vocal song using ACE-Step, saved to storage."""

import asyncio
import yaml


CAPTION = (
    "emotional C-pop ballad, 78 BPM, C Major, piano and strings, "
    "soft female vocal, warm reverb, cinematic arrangement, "
    "studio quality, Chinese pop"
)

LYRICS_SHORT = """\
[Verse]
月光洒在窗台上
思念化成了泪光
你的笑容在远方
温暖我冰冷的心房

[Chorus]
我在等风也等你
穿过千山和万里
不管时光怎样流逝
我的心始终为你
"""

LYRICS_FULL = """\
[Verse 1]
月光洒在窗台上
思念化成了泪光
你的笑容在远方
温暖我冰冷的心房

[Pre-Chorus]
翻开那些旧照片
每一页都是从前

[Chorus]
我在等风也等你
穿过千山和万里
不管时光怎样流逝
我的心始终为你
我在等风也等你

[Verse 2]
星星挂在天空中
像你眼中的柔情
城市的灯火阑珊
却照不亮我孤单

[Pre-Chorus]
拨通了你的号码
听到的只有回答

[Chorus]
我在等风也等你
穿过千山和万里
不管时光怎样流逝
我的心始终为你
我在等风也等你

[Bridge]
也许明天你会来
带着春天的色彩
我们重新开始吧
在那花开的地方

[Chorus]
我在等风也等你
穿过千山和万里
不管时光怎样流逝
我的心始终为你
我在等风也等你

[Outro]
啦啦啦啦啦啦啦
等风也等你
啦啦啦啦啦啦啦
我的心为你
"""

TITLE = "等风也等你"
GENRE = "C-Pop / Ballad"
MOOD = "emotional, warm, nostalgic"


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

    # --- Short version (60s) ---
    print("=" * 60)
    print("Generating SHORT Chinese version (60s)...")
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

    # --- Full version (240s) ---
    print("=" * 60)
    print("Generating FULL Chinese version (240s)...")
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
    print("Both Chinese versions saved to: backend/storage/audio/")
    print(f"  Short (60s):  {filename_short}")
    print(f"  Full (240s):  {filename_full}")
    print(f"  Title: {TITLE}")
    print(f"  Genre: {GENRE}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
