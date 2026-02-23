import logging
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

    def get_audio_path(self, filename: str) -> Path | None:
        path = self.audio_dir / filename
        if path.exists():
            return path
        return None

    def get_cover_path(self, filename: str) -> Path | None:
        path = self.covers_dir / filename
        if path.exists():
            return path
        return None

    def delete_audio(self, filename: str) -> bool:
        path = self.audio_dir / filename
        if path.exists():
            path.unlink()
            logger.info("Deleted audio file: %s", filename)
            return True
        return False

    def delete_cover(self, filename: str) -> bool:
        path = self.covers_dir / filename
        if path.exists():
            path.unlink()
            logger.info("Deleted cover file: %s", filename)
            return True
        return False

    def save_audio(self, data: bytes, fmt: str = "wav") -> str:
        """Write raw audio bytes to disk and return the generated filename."""
        filename = f"{uuid.uuid4().hex}.{fmt}"
        path = self.audio_dir / filename
        path.write_bytes(data)
        logger.info("Saved audio file: %s (%d bytes)", filename, len(data))
        return filename


storage_service = StorageService()
