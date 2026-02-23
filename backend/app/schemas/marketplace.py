from pydantic import BaseModel, Field


class HFModelInfo(BaseModel):
    id: str
    author: str | None = None
    pipeline_tag: str | None = None
    downloads: int = 0
    likes: int = 0
    tags: list[str] = Field(default_factory=list)
    library_name: str | None = None
    license: str | None = None
    size_str: str | None = None
    is_cached: bool = False


class HFModelDetail(HFModelInfo):
    description: str | None = None
    used_storage: int | None = None
    parameters: int | None = None


class HFModelSearchResponse(BaseModel):
    models: list[HFModelInfo]
    total: int


class DownloadRequest(BaseModel):
    repo_id: str


class DownloadResponse(BaseModel):
    download_id: str
    repo_id: str
    status: str


class DownloadProgress(BaseModel):
    download_id: str
    repo_id: str
    status: str = "pending"  # pending / downloading / completed / failed
    progress: float = 0.0
    message: str = ""


class DownloadListResponse(BaseModel):
    downloads: list[DownloadProgress]


class CachedModelInfo(BaseModel):
    repo_id: str
    size_str: str
    nb_files: int
    last_accessed: float


class CachedModelsResponse(BaseModel):
    models: list[CachedModelInfo]


class DeleteCacheResponse(BaseModel):
    success: bool
    message: str
