from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.schemas.generation import GenerationListResponse, GenerationResponse
from backend.app.services.generation import generation_service
from backend.app.services.storage import storage_service

router = APIRouter(prefix="/generations", tags=["history"])


@router.get("", response_model=GenerationListResponse)
async def list_generations(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    items, total = await generation_service.list_generations(
        db, offset=offset, limit=limit
    )
    return GenerationListResponse(items=items, total=total)


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: int,
    db: AsyncSession = Depends(get_db),
):
    gen = await generation_service.get_generation(db, generation_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.delete("/{generation_id}")
async def delete_generation(
    generation_id: int,
    db: AsyncSession = Depends(get_db),
):
    gen = await generation_service.get_generation(db, generation_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    if gen.audio_path:
        from pathlib import Path

        storage_service.delete_audio(Path(gen.audio_path).name)
    await generation_service.delete_generation(db, generation_id)
    return {"detail": "deleted"}
