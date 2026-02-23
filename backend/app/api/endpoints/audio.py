from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.services.storage import storage_service

router = APIRouter(prefix="/audio", tags=["audio"])

MIME_MAP = {
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "flac": "audio/flac",
    "ogg": "audio/ogg",
}


@router.get("/{file_id}")
async def stream_audio(file_id: str):
    path = storage_service.get_audio_path(file_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Audio file not found")
    suffix = path.suffix.lstrip(".")
    media_type = MIME_MAP.get(suffix, "application/octet-stream")
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=path.name,
    )
