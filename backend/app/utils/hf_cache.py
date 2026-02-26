from pathlib import Path

# Weight file extensions that indicate real model data (not just metadata).
_WEIGHT_SUFFIXES = frozenset({
    ".safetensors", ".bin", ".pt", ".pth", ".ckpt", ".onnx",
})


def has_incomplete_blobs(repo_path: Path) -> bool:
    """Return ``True`` if the repo cache directory contains ``.incomplete`` blob files.

    HuggingFace Hub downloads each blob to ``<hash>.incomplete`` first, then
    atomically renames it on completion.  The presence of any ``.incomplete``
    file therefore indicates an interrupted / partial download.
    """
    blobs_dir = repo_path / "blobs"
    if not blobs_dir.is_dir():
        return False
    return any(f.suffix == ".incomplete" for f in blobs_dir.iterdir())


def is_download_complete(repo_path: Path, cached_files: frozenset[str]) -> bool:
    """Return ``True`` only if the cached repo looks fully downloaded.

    Checks two conditions:
    1. No ``.incomplete`` blob files exist (partial download in progress).
    2. At least one model weight file is present in the cache.  A repo with
       only metadata (config.json, tokenizer files, …) but no weights was
       almost certainly interrupted before the large files started.
    """
    if has_incomplete_blobs(repo_path):
        return False
    return any(
        f.rsplit(".", 1)[-1] in ("safetensors", "bin", "pt", "pth", "ckpt", "onnx")
        for f in cached_files
    )
