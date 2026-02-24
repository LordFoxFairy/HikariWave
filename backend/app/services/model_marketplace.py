import asyncio
import logging
import threading
import uuid

from backend.app.schemas.marketplace import (
    CachedModelInfo,
    DownloadProgress,
    HFModelDetail,
    HFModelInfo,
)

logger = logging.getLogger(__name__)


class _ProgressTracker:
    """Custom tqdm-compatible class that captures download progress.

    ``huggingface_hub.snapshot_download`` passes this as ``tqdm_class``.
    The hub calls ``tqdm_class(...)`` to create bar instances and may
    also call ``tqdm_class.get_lock()`` (a class-level method from tqdm).
    """

    def __init__(self, progress_ref: DownloadProgress):
        self._progress = progress_ref
        self._lock = threading.Lock()

    def __call__(self, *args, **kwargs):
        """Called by snapshot_download as tqdm_class(...)."""
        instance = _ProgressTrackerInstance(self._progress, self._lock)
        total = kwargs.get("total")
        if total is not None:
            instance._total = total
            self._progress.status = "downloading"
        return instance

    def get_lock(self):
        """Return a threading lock (expected by huggingface_hub internals)."""
        return self._lock

    def set_lock(self, lock):
        """Set a threading lock (expected by huggingface_hub internals)."""
        self._lock = lock


class _ProgressTrackerInstance:
    """Single progress bar instance (one per file)."""

    def __init__(self, progress_ref: DownloadProgress, lock: threading.Lock):
        self._progress = progress_ref
        self._lock = lock
        self._total = 0
        self._current = 0

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def __iter__(self):
        return self

    def __next__(self):
        raise StopIteration

    def update(self, n=1):
        self._current += n
        if self._total > 0:
            pct = min(100.0, (self._current / self._total) * 100)
            self._progress.progress = round(pct, 1)
            self._progress.message = f"Downloading: {self._current}/{self._total} bytes"

    def close(self):
        pass

    def set_description(self, desc=None, refresh=True):
        if desc:
            self._progress.message = desc

    def set_postfix_str(self, s="", refresh=True):
        pass

    def get_lock(self):
        return self._lock

    def set_lock(self, lock):
        self._lock = lock

    @property
    def total(self):
        return self._total

    @total.setter
    def total(self, value):
        self._total = value or 0

    def reset(self, total=None):
        self._current = 0
        if total is not None:
            self._total = total


class ModelMarketplaceService:
    """Service for browsing and managing HuggingFace models."""

    def __init__(self):
        self._downloads: dict[str, DownloadProgress] = {}

    async def search_models(
        self,
        query: str | None = None,
        pipeline_tag: str | None = None,
        sort: str = "downloads",
        limit: int = 20,
    ) -> list[HFModelInfo]:
        from huggingface_hub import HfApi

        def _search() -> list:
            api = HfApi()
            return list(
                api.list_models(
                    search=query or None,
                    pipeline_tag=pipeline_tag or None,
                    sort=sort,
                    direction=-1,
                    limit=limit,
                )
            )

        models = await asyncio.to_thread(_search)
        cached_ids = await self._get_cached_ids()

        return [
            HFModelInfo(
                id=m.id,
                author=m.author,
                pipeline_tag=m.pipeline_tag,
                downloads=m.downloads or 0,
                likes=m.likes or 0,
                tags=list(m.tags) if m.tags else [],
                library_name=m.library_name,
                is_cached=m.id in cached_ids,
            )
            for m in models
        ]

    async def get_model_info(self, repo_id: str) -> HFModelDetail:
        from huggingface_hub import HfApi

        def _fetch_info():
            api = HfApi()
            return api.model_info(
                repo_id,
                expand=[
                    "cardData",
                    "downloadsAllTime",
                    "likes",
                    "safetensors",
                    "usedStorage",
                ],
            )

        info = await asyncio.to_thread(_fetch_info)

        license_val = None
        if info.card_data and hasattr(info.card_data, "license"):
            license_val = info.card_data.license

        parameters = None
        if info.safetensors and hasattr(info.safetensors, "total"):
            parameters = info.safetensors.total

        used_storage = None
        if hasattr(info, "used_storage") and info.used_storage is not None:
            used_storage = info.used_storage

        size_str = None
        if used_storage:
            size_str = self._format_size(used_storage)

        cached_ids = await self._get_cached_ids()

        return HFModelDetail(
            id=info.id,
            author=info.author,
            pipeline_tag=info.pipeline_tag,
            downloads=info.downloads or 0,
            likes=info.likes or 0,
            tags=list(info.tags) if info.tags else [],
            library_name=info.library_name,
            license=license_val,
            size_str=size_str,
            used_storage=used_storage,
            parameters=parameters,
            is_cached=info.id in cached_ids,
        )

    async def start_download(self, repo_id: str) -> DownloadProgress:
        download_id = str(uuid.uuid4())[:8]
        progress = DownloadProgress(
            download_id=download_id,
            repo_id=repo_id,
            status="pending",
            progress=0.0,
            message="Queued",
        )
        self._downloads[download_id] = progress
        task = asyncio.create_task(self._run_download(download_id, repo_id))
        task.add_done_callback(lambda _t: None)  # prevent GC of task
        return progress

    async def _run_download(self, download_id: str, repo_id: str):
        progress = self._downloads[download_id]
        try:
            progress.status = "downloading"
            progress.message = "Starting download..."

            from huggingface_hub import snapshot_download

            tracker = _ProgressTracker(progress)
            await asyncio.to_thread(
                snapshot_download,
                repo_id=repo_id,
                tqdm_class=tracker,
            )

            progress.status = "completed"
            progress.progress = 100.0
            progress.message = "Download complete"
            logger.info("Download completed: %s", repo_id)
        except Exception as e:
            progress.status = "failed"
            progress.message = f"Download failed: {e!s}"
            logger.error("Download failed for %s: %s", repo_id, e)

    def get_download_progress(self, download_id: str) -> DownloadProgress | None:
        return self._downloads.get(download_id)

    def get_all_downloads(self) -> list[DownloadProgress]:
        return list(self._downloads.values())

    async def list_cached_models(self) -> list[CachedModelInfo]:
        from huggingface_hub import scan_cache_dir

        cache_info = await asyncio.to_thread(scan_cache_dir)
        return [
            CachedModelInfo(
                repo_id=repo.repo_id,
                size_str=repo.size_on_disk_str,
                nb_files=repo.nb_files,
                last_accessed=repo.last_accessed,
            )
            for repo in cache_info.repos
            if repo.repo_type == "model"
        ]

    async def delete_cached_model(self, repo_id: str) -> bool:
        from huggingface_hub import scan_cache_dir

        def _delete() -> bool:
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_id == repo_id:
                    hashes = [rev.commit_hash for rev in repo.revisions]
                    strategy = cache_info.delete_revisions(*hashes)
                    strategy.execute()
                    logger.info("Deleted cached model: %s", repo_id)
                    return True
            return False

        return await asyncio.to_thread(_delete)

    async def _get_cached_ids(self) -> set[str]:
        try:
            from huggingface_hub import scan_cache_dir

            cache_info = await asyncio.to_thread(scan_cache_dir)
            return {
                repo.repo_id for repo in cache_info.repos if repo.repo_type == "model"
            }
        except Exception:
            return set()

    @staticmethod
    def _format_size(size_bytes: int) -> str:
        for unit in ("B", "KB", "MB", "GB", "TB"):
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"


marketplace_service = ModelMarketplaceService()
