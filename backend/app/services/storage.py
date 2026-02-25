import asyncio
import logging
import shutil
import tempfile
import uuid
from pathlib import Path

from backend.app.core.settings import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self) -> None:
        self.base_dir = Path(settings.storage_dir)
        self.audio_dir = self.base_dir / settings.audio_subdir
        self.audio_dir.mkdir(parents=True, exist_ok=True)
        self.covers_dir = self.base_dir / settings.covers_subdir
        self.covers_dir.mkdir(parents=True, exist_ok=True)
        self.lyrics_dir = self.base_dir / "lyrics"
        self.lyrics_dir.mkdir(parents=True, exist_ok=True)

    async def get_audio_path(self, filename: str) -> Path | None:
        path = self.audio_dir / filename
        exists = await asyncio.to_thread(path.exists)
        if exists:
            return path
        return None

    async def get_cover_path(self, filename: str) -> Path | None:
        path = self.covers_dir / filename
        exists = await asyncio.to_thread(path.exists)
        if exists:
            return path
        return None

    async def delete_audio(self, filename: str) -> bool:
        path = self.audio_dir / filename
        exists = await asyncio.to_thread(path.exists)
        if exists:
            await asyncio.to_thread(path.unlink)
            logger.info("Deleted audio file: %s", filename)
            return True
        return False

    async def delete_cover(self, filename: str) -> bool:
        path = self.covers_dir / filename
        exists = await asyncio.to_thread(path.exists)
        if exists:
            await asyncio.to_thread(path.unlink)
            logger.info("Deleted cover file: %s", filename)
            return True
        return False

    # -- Lyrics file storage --------------------------------------------------

    async def save_lyrics(self, audio_filename: str, lyrics: str) -> str:
        """Save plain lyrics as a .txt file matching the audio basename.

        Returns the lyrics filename (e.g. ``abc123.txt``).
        """
        stem = Path(audio_filename).stem
        filename = f"{stem}.txt"
        path = self.lyrics_dir / filename
        await asyncio.to_thread(path.write_text, lyrics, "utf-8")
        logger.info("Saved lyrics file: %s", filename)
        return filename

    async def save_lrc(self, audio_filename: str, lrc_text: str) -> str:
        """Save LRC-format timestamped lyrics as a .lrc file.

        Returns the lrc filename (e.g. ``abc123.lrc``).
        """
        stem = Path(audio_filename).stem
        filename = f"{stem}.lrc"
        path = self.lyrics_dir / filename
        await asyncio.to_thread(path.write_text, lrc_text, "utf-8")
        logger.info("Saved LRC file: %s", filename)
        return filename

    async def get_lyrics_path(self, filename: str) -> Path | None:
        path = self.lyrics_dir / filename
        exists = await asyncio.to_thread(path.exists)
        return path if exists else None

    async def delete_lyrics(self, audio_filename: str) -> None:
        """Delete .txt and .lrc files matching the audio basename."""
        stem = Path(audio_filename).stem
        for ext in (".txt", ".lrc"):
            path = self.lyrics_dir / f"{stem}{ext}"
            exists = await asyncio.to_thread(path.exists)
            if exists:
                await asyncio.to_thread(path.unlink)
                logger.info("Deleted lyrics file: %s%s", stem, ext)

    async def save_audio(self, data: bytes, fmt: str = "wav") -> str:
        """Write raw audio bytes to disk and return the generated filename."""
        filename = f"{uuid.uuid4().hex}.{fmt}"
        path = self.audio_dir / filename
        await asyncio.to_thread(path.write_bytes, data)
        logger.info("Saved audio file: %s (%d bytes)", filename, len(data))
        return filename

    async def save_audio_with_metadata(
        self, data: bytes, fmt: str = "wav", metadata: dict | None = None
    ) -> str:
        """Write audio bytes to disk with embedded metadata tags.

        Uses mutagen to embed ID3 (mp3/wav) or Vorbis (flac/ogg) tags.
        Falls back to saving raw bytes if tagging fails.
        """
        filename = f"{uuid.uuid4().hex}.{fmt}"
        final_path = self.audio_dir / filename

        if not metadata:
            await asyncio.to_thread(final_path.write_bytes, data)
            logger.info(
                "Saved audio file (no metadata): %s (%d bytes)",
                filename, len(data),
            )
            return filename

        try:
            filename = await asyncio.to_thread(
                self._write_tagged_audio, data, fmt, metadata, final_path
            )
        except Exception:
            logger.exception("Failed to embed metadata, saving raw audio: %s", filename)
            await asyncio.to_thread(final_path.write_bytes, data)

        logger.info("Saved audio file: %s (%d bytes)", filename, len(data))
        return filename

    async def embed_cover_art(self, audio_filename: str, cover_filename: str) -> None:
        """Embed cover art image into an existing audio file."""
        audio_path = self.audio_dir / audio_filename
        cover_path = self.covers_dir / cover_filename
        if not audio_path.exists() or not cover_path.exists():
            return
        await asyncio.to_thread(self._embed_cover_sync, audio_path, cover_path)

    @staticmethod
    def _embed_cover_sync(audio_path: Path, cover_path: Path) -> None:
        """Synchronous helper to embed cover art."""
        image_bytes = cover_path.read_bytes()
        mime = "image/png" if cover_path.suffix.lower() == ".png" else "image/jpeg"
        suffix = audio_path.suffix.lower()

        if suffix == ".mp3":
            from mutagen.mp3 import MP3
            from mutagen.id3 import APIC, ID3
            audio = MP3(str(audio_path))
            if audio.tags is None:
                audio.add_tags()
            audio.tags.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image_bytes))
            audio.save()
        elif suffix == ".wav":
            from mutagen.wave import WAVE
            from mutagen.id3 import APIC, ID3
            audio = WAVE(str(audio_path))
            if audio.tags is None:
                audio.add_tags()
            audio.tags.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image_bytes))
            audio.save()
        elif suffix == ".flac":
            from mutagen.flac import FLAC, Picture
            audio = FLAC(str(audio_path))
            pic = Picture()
            pic.type = 3
            pic.mime = mime
            pic.desc = 'Cover'
            pic.data = image_bytes
            audio.add_picture(pic)
            audio.save()

    @staticmethod
    def _write_tagged_audio(
        data: bytes, fmt: str, metadata: dict, final_path: Path
    ) -> str:
        """Synchronous helper: write bytes to temp file, tag, move to final."""
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=f".{fmt}")
        try:
            import os
            os.close(tmp_fd)
            Path(tmp_path).write_bytes(data)

            fmt_lower = fmt.lower()
            if fmt_lower == "mp3":
                _tag_mp3(tmp_path, metadata)
            elif fmt_lower == "wav":
                _tag_wav(tmp_path, metadata)
            elif fmt_lower == "flac":
                _tag_flac(tmp_path, metadata)
            elif fmt_lower in ("ogg", "oga"):
                _tag_ogg(tmp_path, metadata)
            else:
                logger.warning("Unsupported format for tagging: %s", fmt)

            shutil.move(tmp_path, final_path)
        except Exception:
            # Clean up temp file on failure, then re-raise so caller can
            # fall back to raw save.
            Path(tmp_path).unlink(missing_ok=True)
            raise

        return final_path.name


def _tag_mp3(path: str, metadata: dict) -> None:
    from mutagen.id3 import APIC, COMM, ID3, TALB, TBPM, TCON, TDRC, TIT2, TPE1, TXXX, USLT
    from mutagen.mp3 import MP3

    title = metadata.get("title", "")
    artist = metadata.get("artist", "")
    genre = metadata.get("genre", "")
    comment = metadata.get("comment", "")
    album = metadata.get("album", "")
    lyrics = metadata.get("lyrics", "")
    tempo = metadata.get("tempo", "")
    year = metadata.get("year", "")
    mood = metadata.get("mood", "")
    cover_art_path = metadata.get("cover_art_path", "")

    audio = MP3(path)
    if audio.tags is None:
        audio.add_tags()
    tags = audio.tags
    if not isinstance(tags, ID3):
        return
    if title:
        tags.add(TIT2(encoding=3, text=[title]))
    if artist:
        tags.add(TPE1(encoding=3, text=[artist]))
    if genre:
        tags.add(TCON(encoding=3, text=[genre]))
    if comment:
        tags.add(COMM(encoding=3, lang="eng", desc="", text=[comment]))
    if album:
        tags.add(TALB(encoding=3, text=[album]))
    if lyrics:
        tags.add(USLT(encoding=3, lang="eng", desc="", text=lyrics))
    if tempo:
        tags.add(TBPM(encoding=3, text=[str(tempo)]))
    if year:
        tags.add(TDRC(encoding=3, text=[year]))
    if mood:
        tags.add(TXXX(encoding=3, desc='mood', text=[mood]))
    if cover_art_path:
        try:
            from backend.app.core.settings import settings as _settings
            cover_full = Path(_settings.storage_dir) / _settings.covers_subdir / cover_art_path
            if cover_full.exists():
                image_bytes = cover_full.read_bytes()
                mime = "image/png" if cover_full.suffix.lower() == ".png" else "image/jpeg"
                tags.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image_bytes))
        except Exception:
            logger.warning("Failed to embed cover art in MP3: %s", cover_art_path)
    audio.save()


def _tag_wav(path: str, metadata: dict) -> None:
    from mutagen.id3 import APIC, COMM, ID3, TALB, TBPM, TCON, TDRC, TIT2, TPE1, TXXX, USLT
    from mutagen.wave import WAVE

    title = metadata.get("title", "")
    artist = metadata.get("artist", "")
    genre = metadata.get("genre", "")
    comment = metadata.get("comment", "")
    album = metadata.get("album", "")
    lyrics = metadata.get("lyrics", "")
    tempo = metadata.get("tempo", "")
    year = metadata.get("year", "")
    mood = metadata.get("mood", "")
    cover_art_path = metadata.get("cover_art_path", "")

    audio = WAVE(path)
    if audio.tags is None:
        audio.add_tags()
    tags = audio.tags
    if not isinstance(tags, ID3):
        return
    if title:
        tags.add(TIT2(encoding=3, text=[title]))
    if artist:
        tags.add(TPE1(encoding=3, text=[artist]))
    if genre:
        tags.add(TCON(encoding=3, text=[genre]))
    if comment:
        tags.add(COMM(encoding=3, lang="eng", desc="", text=[comment]))
    if album:
        tags.add(TALB(encoding=3, text=[album]))
    if lyrics:
        tags.add(USLT(encoding=3, lang="eng", desc="", text=lyrics))
    if tempo:
        tags.add(TBPM(encoding=3, text=[str(tempo)]))
    if year:
        tags.add(TDRC(encoding=3, text=[year]))
    if mood:
        tags.add(TXXX(encoding=3, desc='mood', text=[mood]))
    if cover_art_path:
        try:
            from backend.app.core.settings import settings as _settings
            cover_full = Path(_settings.storage_dir) / _settings.covers_subdir / cover_art_path
            if cover_full.exists():
                image_bytes = cover_full.read_bytes()
                mime = "image/png" if cover_full.suffix.lower() == ".png" else "image/jpeg"
                tags.add(APIC(encoding=3, mime=mime, type=3, desc='Cover', data=image_bytes))
        except Exception:
            logger.warning("Failed to embed cover art in WAV: %s", cover_art_path)
    audio.save()


def _tag_flac(path: str, metadata: dict) -> None:
    from mutagen.flac import FLAC, Picture

    title = metadata.get("title", "")
    artist = metadata.get("artist", "")
    genre = metadata.get("genre", "")
    comment = metadata.get("comment", "")
    album = metadata.get("album", "")
    lyrics = metadata.get("lyrics", "")
    tempo = metadata.get("tempo", "")
    year = metadata.get("year", "")
    mood = metadata.get("mood", "")
    cover_art_path = metadata.get("cover_art_path", "")

    audio = FLAC(path)
    if title:
        audio["title"] = title
    if artist:
        audio["artist"] = artist
    if genre:
        audio["genre"] = genre
    if comment:
        audio["comment"] = comment
    if album:
        audio["album"] = album
    if lyrics:
        audio["lyrics"] = lyrics
    if tempo:
        audio["bpm"] = str(tempo)
    if year:
        audio["date"] = year
    if mood:
        audio["mood"] = mood
    if cover_art_path:
        try:
            from backend.app.core.settings import settings as _settings
            cover_full = Path(_settings.storage_dir) / _settings.covers_subdir / cover_art_path
            if cover_full.exists():
                image_bytes = cover_full.read_bytes()
                mime = "image/png" if cover_full.suffix.lower() == ".png" else "image/jpeg"
                pic = Picture()
                pic.type = 3
                pic.mime = mime
                pic.desc = 'Cover'
                pic.data = image_bytes
                audio.add_picture(pic)
        except Exception:
            logger.warning("Failed to embed cover art in FLAC: %s", cover_art_path)
    audio.save()


def _tag_ogg(path: str, metadata: dict) -> None:
    from mutagen.oggvorbis import OggVorbis

    title = metadata.get("title", "")
    artist = metadata.get("artist", "")
    genre = metadata.get("genre", "")
    comment = metadata.get("comment", "")
    album = metadata.get("album", "")
    lyrics = metadata.get("lyrics", "")
    tempo = metadata.get("tempo", "")
    year = metadata.get("year", "")
    mood = metadata.get("mood", "")

    audio = OggVorbis(path)
    if title:
        audio["title"] = title
    if artist:
        audio["artist"] = artist
    if genre:
        audio["genre"] = genre
    if comment:
        audio["comment"] = comment
    if album:
        audio["album"] = album
    if lyrics:
        audio["lyrics"] = lyrics
    if tempo:
        audio["bpm"] = str(tempo)
    if year:
        audio["date"] = year
    if mood:
        audio["mood"] = mood
    audio.save()


storage_service = StorageService()
