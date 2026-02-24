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

    @staticmethod
    def _write_tagged_audio(
        data: bytes, fmt: str, metadata: dict, final_path: Path
    ) -> str:
        """Synchronous helper: write bytes to temp file, tag, move to final."""
        title = metadata.get("title", "")
        artist = metadata.get("artist", "")
        genre = metadata.get("genre", "")
        comment = metadata.get("comment", "")
        album = metadata.get("album", "")

        tmp_fd, tmp_path = tempfile.mkstemp(suffix=f".{fmt}")
        try:
            import os
            os.close(tmp_fd)
            Path(tmp_path).write_bytes(data)

            fmt_lower = fmt.lower()
            if fmt_lower == "mp3":
                _tag_mp3(tmp_path, title, artist, genre, comment, album)
            elif fmt_lower == "wav":
                _tag_wav(tmp_path, title, artist, genre, comment, album)
            elif fmt_lower == "flac":
                _tag_flac(tmp_path, title, artist, genre, comment, album)
            elif fmt_lower in ("ogg", "oga"):
                _tag_ogg(tmp_path, title, artist, genre, comment, album)
            else:
                logger.warning("Unsupported format for tagging: %s", fmt)

            shutil.move(tmp_path, final_path)
        except Exception:
            # Clean up temp file on failure, then re-raise so caller can
            # fall back to raw save.
            Path(tmp_path).unlink(missing_ok=True)
            raise

        return final_path.name


def _tag_mp3(
    path: str, title: str, artist: str, genre: str, comment: str, album: str
) -> None:
    from mutagen.id3 import COMM, ID3, TALB, TCON, TIT2, TPE1
    from mutagen.mp3 import MP3

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
    audio.save()


def _tag_wav(
    path: str, title: str, artist: str, genre: str, comment: str, album: str
) -> None:
    from mutagen.id3 import COMM, ID3, TALB, TCON, TIT2, TPE1
    from mutagen.wave import WAVE

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
    audio.save()


def _tag_flac(
    path: str, title: str, artist: str, genre: str, comment: str, album: str
) -> None:
    from mutagen.flac import FLAC

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
    audio.save()


def _tag_ogg(
    path: str, title: str, artist: str, genre: str, comment: str, album: str
) -> None:
    from mutagen.oggvorbis import OggVorbis

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
    audio.save()


storage_service = StorageService()
