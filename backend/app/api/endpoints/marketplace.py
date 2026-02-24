from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies import get_marketplace_service
from backend.app.schemas.marketplace import (
    CachedModelsResponse,
    DeleteCacheResponse,
    DownloadListResponse,
    DownloadProgress,
    DownloadRequest,
    DownloadResponse,
    HFModelDetail,
    HFModelSearchResponse,
)
from backend.app.services.model_marketplace import ModelMarketplaceService

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("/search", response_model=HFModelSearchResponse)
async def search_models(
    q: str | None = None,
    pipeline_tag: str | None = None,
    sort: str = "downloads",
    limit: int = 20,
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """Search HuggingFace Hub for models."""
    models = await svc.search_models(
        query=q,
        pipeline_tag=pipeline_tag,
        sort=sort,
        limit=limit,
    )
    return HFModelSearchResponse(models=models, total=len(models))


@router.get("/model/{repo_id:path}", response_model=HFModelDetail)
async def get_model_info(
    repo_id: str,
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """Get detailed info for a specific model."""
    try:
        return await svc.get_model_info(repo_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/download", response_model=DownloadResponse)
async def start_download(
    body: DownloadRequest,
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """Start downloading a model in the background."""
    progress = await svc.start_download(body.repo_id)
    return DownloadResponse(
        download_id=progress.download_id,
        repo_id=progress.repo_id,
        status=progress.status,
    )


@router.get("/downloads", response_model=DownloadListResponse)
async def list_downloads(
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """List all downloads with progress."""
    return DownloadListResponse(downloads=svc.get_all_downloads())


@router.get("/downloads/{download_id}", response_model=DownloadProgress)
async def get_download(
    download_id: str,
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """Get progress for a specific download."""
    progress = svc.get_download_progress(download_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="Download not found")
    return progress


@router.get("/cache", response_model=CachedModelsResponse)
async def list_cached_models(
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """List locally cached models."""
    return CachedModelsResponse(models=await svc.list_cached_models())


@router.delete("/cache/{repo_id:path}", response_model=DeleteCacheResponse)
async def delete_cached_model(
    repo_id: str,
    svc: ModelMarketplaceService = Depends(get_marketplace_service),
):
    """Delete a model from the local cache."""
    deleted = await svc.delete_cached_model(repo_id)
    if deleted:
        return DeleteCacheResponse(
            success=True, message=f"Deleted {repo_id} from cache"
        )
    raise HTTPException(status_code=404, detail=f"Model {repo_id} not found in cache")
