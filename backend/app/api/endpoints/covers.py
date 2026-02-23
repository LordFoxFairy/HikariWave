from pathlib import PurePosixPath

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.app.services.storage import storage_service

router = APIRouter(prefix="/covers", tags=["covers"])

MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}


@router.get("/{file_id:path}")
async def serve_cover(file_id: str):
    # Extract basename to prevent path traversal attacks.
    filename = PurePosixPath(file_id).name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid file_id")
    path = await storage_service.get_cover_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Cover art not found")
    suffix = path.suffix.lstrip(".")
    media_type = MIME_MAP.get(suffix, "application/octet-stream")
    return FileResponse(
        path=str(path),
        media_type=media_type,
        filename=path.name,
    )
