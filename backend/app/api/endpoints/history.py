from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies import get_generation_service
from backend.app.schemas.generation import GenerationListResponse, GenerationResponse
from backend.app.services.generation import GenerationService

router = APIRouter(prefix="/generations", tags=["history"])


@router.get("", response_model=GenerationListResponse)
async def list_generations(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    svc: GenerationService = Depends(get_generation_service),
):
    items, total = await svc.list_generations(offset=offset, limit=limit)
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
