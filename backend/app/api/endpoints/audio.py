import asyncio
import logging
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audio", tags=["audio"])

MIME_MAP = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "flac": "audio/flac",
    "ogg": "audio/ogg",
}

SUPPORTED_FORMATS = {"mp3", "flac", "ogg", "wav"}


@router.get("/{file_id:path}")
async def stream_audio(
    file_id: str,
    audio_format: str | None = Query(
        None,
        alias="format",
        description="Convert to: mp3, flac, ogg, wav",
    ),
):
    # Extract basename to prevent path traversal attacks.
    # The frontend may send a full path or just a filename.
    filename = PurePosixPath(file_id).name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid file_id")
    path = await storage_service.get_audio_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")

    # Format conversion requested
    if audio_format and audio_format in SUPPORTED_FORMATS:
        source_ext = path.suffix.lstrip(".")
        if audio_format != source_ext:
            converted = await _convert_audio(path, audio_format)
            if converted is not None:
                media_type = MIME_MAP.get(audio_format, "application/octet-stream")
                return FileResponse(
                    path=str(converted),
                    media_type=media_type,
                    filename=converted.name,
                )
            # Conversion failed, fall through to return original
            logger.warning(
                "Audio conversion to %s failed, returning original",
                audio_format,
            )

    suffix = path.suffix.lstrip(".")
    media_type = MIME_MAP.get(suffix, "application/octet-stream")
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=path.name,
    )


async def _convert_audio(source_path: Path, target_format: str) -> Path | None:
    """Convert audio using pydub. Returns converted file path or None."""

    def _do_convert() -> Path | None:
        from pydub import AudioSegment

        converted_name = source_path.stem + f".{target_format}"
        converted_path = source_path.parent / converted_name
        if converted_path.exists():
            return converted_path
        audio = AudioSegment.from_file(str(source_path))
        audio.export(str(converted_path), format=target_format)
        return converted_path

    try:
        return await asyncio.to_thread(_do_convert)
    except ImportError:
        logger.warning("pydub not installed, cannot convert audio format")
        return None
    except Exception:
        logger.exception("Audio format conversion failed")
        return None
