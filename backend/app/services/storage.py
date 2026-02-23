import logging
from pathlib import Path

from backend.app.core.settings import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self) -> None:
        self.base_dir = Path(settings.storage_dir)
        self.audio_dir = self.base_dir / settings.audio_subdir
        self.audio_dir.mkdir(parents=True, exist_ok=True)

    def get_audio_path(self, filename: str) -> Path | None:
        path = self.audio_dir / filename
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

    def get_audio_dir(self) -> Path:
        return self.audio_dir

    def disk_usage(self) -> dict:
        total_size = sum(
            f.stat().st_size for f in self.audio_dir.rglob("*") if f.is_file()
        )
        return {
            "directory": str(self.audio_dir),
            "total_bytes": total_size,
            "total_mb": round(total_size / (1024 * 1024), 2),
        }


storage_service = StorageService()
