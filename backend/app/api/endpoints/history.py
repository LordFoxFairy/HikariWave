from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies import get_generation_service
from backend.app.schemas.generation import (
    GenerationListResponse,
    GenerationResponse,
    LikeResponse,
)
from backend.app.services.music_generation import GenerationService

router = APIRouter(prefix="/generations", tags=["history"])


@router.get("", response_model=GenerationListResponse)
async def list_generations(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = None,
    is_liked: bool | None = None,
    genre: str | None = None,
    mood: str | None = None,
    status: str | None = None,
    sort: str = "created_at",
    sort_dir: str = "desc",
    svc: GenerationService = Depends(get_generation_service),
):
    items, total = await svc.list_generations(
        offset=offset,
        limit=limit,
        search=search,
        is_liked=is_liked,
        genre=genre,
        mood=mood,
        status=status,
        sort=sort,
        sort_dir=sort_dir,
    )
    return GenerationListResponse(items=items, total=total)


@router.get("/{generation_id}", response_model=GenerationResponse)
async def get_generation(
    generation_id: int,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.get_generation(generation_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.delete("/{generation_id}")
async def delete_generation(
    generation_id: int,
    svc: GenerationService = Depends(get_generation_service),
):
    gen = await svc.get_generation(generation_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    await svc.delete_generation(generation_id)
    return {"detail": "deleted"}


@router.post("/{generation_id}/toggle-like", response_model=LikeResponse)
async def toggle_like(
    generation_id: int,
    svc: GenerationService = Depends(get_generation_service),
):
    try:
        is_liked = await svc.toggle_like(generation_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return LikeResponse(generation_id=generation_id, is_liked=is_liked)
