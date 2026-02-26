import asyncio
import logging
import os
import threading
import uuid

from backend.app.schemas.marketplace import (
    AceStepModelInfo,
    CachedModelInfo,
    DownloadProgress,
    HFModelDetail,
    HFModelInfo,
)

logger = logging.getLogger(__name__)


def _disable_hf_transfer() -> None:
    """Forcefully disable hf_transfer at both env and runtime level."""
    os.environ.pop("HF_HUB_ENABLE_HF_TRANSFER", None)
    try:
        from huggingface_hub import constants as hf_constants

        hf_constants.HF_HUB_ENABLE_HF_TRANSFER = False
    except Exception:
        pass


def _guard_hf_transfer() -> None:
    """Disable ``HF_HUB_ENABLE_HF_TRANSFER`` when it cannot work reliably.

    Two cases where hf_transfer must be disabled:
    1. The ``hf_transfer`` Rust package is not installed.
    2. A custom HF_ENDPOINT (mirror) is configured — hf_transfer's Rust
       downloader is incompatible with most mirror endpoints.
    """
    # Check both the env var and the runtime constant (HF Hub caches the
    # value at import time, so the env var alone is not sufficient).
    try:
        from huggingface_hub import constants as hf_constants

        runtime_enabled = getattr(hf_constants, "HF_HUB_ENABLE_HF_TRANSFER", False)
    except Exception:
        runtime_enabled = False

    if os.environ.get("HF_HUB_ENABLE_HF_TRANSFER") != "1" and not runtime_enabled:
        return

    # hf_transfer does not support custom mirror endpoints
    hf_endpoint = os.environ.get("HF_ENDPOINT", "")
    if hf_endpoint and "huggingface.co" not in hf_endpoint:
        _disable_hf_transfer()
        logger.info(
            "hf_transfer disabled — incompatible with mirror %s",
            hf_endpoint,
        )
        return

    try:
        import hf_transfer  # noqa: F401
    except ImportError:
        _disable_hf_transfer()
        logger.info("hf_transfer not installed — disabled fast download")

ACESTEP_MODELS: list[dict[str, str]] = [
    # Main model bundle (includes DiT turbo + default LM 1.7B)
    {
        "name": "Ace-Step1.5",
        "repo_id": "ACE-Step/Ace-Step1.5",
        "category": "base",
        "size_str": "~10 GB",
        "description": "ACE-Step v1.5 — main model bundle (required)",
    },
    # Language Models
    {
        "name": "acestep-5Hz-lm-0.6B",
        "repo_id": "ACE-Step/acestep-5Hz-lm-0.6B",
        "category": "lm",
        "size_str": "~1.2 GB",
        "description": "5Hz LM 0.6B — lightweight",
    },
    {
        "name": "acestep-5Hz-lm-4B",
        "repo_id": "ACE-Step/acestep-5Hz-lm-4B",
        "category": "lm",
        "size_str": "~8 GB",
        "description": "5Hz LM 4B — best quality",
    },
    # DiT Variants
    {
        "name": "acestep-v15-sft",
        "repo_id": "ACE-Step/acestep-v15-sft",
        "category": "dit",
        "size_str": "~4 GB",
        "description": "DiT SFT — high quality 50-step",
    },
    {
        "name": "acestep-v15-base",
        "repo_id": "ACE-Step/acestep-v15-base",
        "category": "dit",
        "size_str": "~4 GB",
        "description": "DiT Base — good for fine-tuning",
    },
    {
        "name": "acestep-v15-turbo-shift1",
        "repo_id": "ACE-Step/acestep-v15-turbo-shift1",
        "category": "dit",
        "size_str": "~4 GB",
        "description": "DiT Turbo Shift1",
    },
    {
        "name": "acestep-v15-turbo-shift3",
        "repo_id": "ACE-Step/acestep-v15-turbo-shift3",
        "category": "dit",
        "size_str": "~4 GB",
        "description": "DiT Turbo Shift3",
    },
]


class _ProgressTracker:
    """Custom tqdm-compatible class that captures download progress.

    ``huggingface_hub.snapshot_download`` passes this as ``tqdm_class``.
    The hub calls ``tqdm_class(...)`` to create bar instances and may
    also call ``tqdm_class.get_lock()`` (a class-level method from tqdm).

    Progress is aggregated across all file bars so the user sees a single
    overall percentage instead of whichever file happened to update last.
    """

    def __init__(self, progress_ref: DownloadProgress):
        self._progress = progress_ref
        self._lock = threading.Lock()
        # Aggregate byte counters shared by all per-file instances.
        self._total_bytes = 0
        self._downloaded_bytes = 0

    def __call__(self, *args, **kwargs):
        """Called by snapshot_download as tqdm_class(...)."""
        instance = _ProgressTrackerInstance(self)
        total = kwargs.get("total")
        if total is not None:
            instance._total = total
            with self._lock:
                self._total_bytes += total
            self._progress.status = "downloading"
        return instance

    def _update_progress(self, delta: int):
        """Called by instances to report downloaded bytes."""
        with self._lock:
            self._downloaded_bytes += delta
            if self._total_bytes > 0:
                pct = min(100.0, (self._downloaded_bytes / self._total_bytes) * 100)
                self._progress.progress = round(pct, 1)
                self._progress.message = (
                    f"Downloading: {self._format(self._downloaded_bytes)}"
                    f" / {self._format(self._total_bytes)}"
                )

    @staticmethod
    def _format(n: int) -> str:
        """Human-readable byte size."""
        for unit in ("B", "KB", "MB", "GB"):
            if n < 1024:
                return f"{n:.1f} {unit}"
            n /= 1024
        return f"{n:.1f} TB"

    def get_lock(self):
        """Return a threading lock (expected by huggingface_hub internals)."""
        return self._lock

    def set_lock(self, lock):
        """Set a threading lock (expected by huggingface_hub internals)."""
        self._lock = lock


class _ProgressTrackerInstance:
    """Single progress bar instance (one per file)."""

    def __init__(self, tracker: _ProgressTracker):
        self._tracker = tracker
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
        self._tracker._update_progress(n)

    def close(self):
        pass

    def set_description(self, desc=None, refresh=True):
        pass

    def set_postfix_str(self, s="", refresh=True):
        pass

    def get_lock(self):
        return self._tracker._lock

    def set_lock(self, lock):
        self._tracker._lock = lock

    @property
    def total(self):
        return self._total

    @total.setter
    def total(self, value):
        old = self._total
        self._total = value or 0
        # Adjust the shared total if HF Hub changes the file size after init.
        diff = self._total - old
        if diff:
            with self._tracker._lock:
                self._tracker._total_bytes += diff

    def reset(self, total=None):
        self._current = 0
        if total is not None:
            self.total = total


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

            _guard_hf_transfer()
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

        from backend.app.utils.hf_cache import is_download_complete

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
            and repo.nb_files > 0
            and is_download_complete(
                repo.repo_path,
                frozenset(
                    f.file_name for rev in repo.revisions for f in rev.files
                ),
            )
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

    async def list_acestep_models(self) -> list[AceStepModelInfo]:
        """Return the curated ACE-Step sub-model list with download status."""
        cached_ids = await self._get_cached_ids()
        return [
            AceStepModelInfo(**m, is_cached=m["repo_id"] in cached_ids)
            for m in ACESTEP_MODELS
        ]

    async def _get_cached_ids(self) -> set[str]:
        try:
            from huggingface_hub import scan_cache_dir

            from backend.app.utils.hf_cache import is_download_complete

            cache_info = await asyncio.to_thread(scan_cache_dir)
            return {
                repo.repo_id
                for repo in cache_info.repos
                if repo.repo_type == "model"
                and repo.nb_files > 0
                and is_download_complete(
                    repo.repo_path,
                    frozenset(
                        f.file_name for rev in repo.revisions for f in rev.files
                    ),
                )
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
