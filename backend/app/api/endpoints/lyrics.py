import logging
from pathlib import PurePosixPath

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from backend.app.services.storage import storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lyrics", tags=["lyrics"])

MIME_MAP = {
    ".lrc": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


@router.get("/{file_id:path}")
async def get_lyrics_file(file_id: str):
    """Serve a lyrics file (.lrc or .txt) from the lyrics directory.

    Standard music players store lyrics as sidecar files next to audio.
    This endpoint allows direct file access for compatibility.
    """
    filename = PurePosixPath(file_id).name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid file_id")

    # Only allow .lrc and .txt files
    suffix = PurePosixPath(filename).suffix.lower()
    if suffix not in (".lrc", ".txt"):
        raise HTTPException(status_code=400, detail="Only .lrc and .txt files supported")

    path = await storage_service.get_lyrics_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Lyrics file not found")

    media_type = MIME_MAP.get(suffix, "text/plain; charset=utf-8")
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=filename,
    )
