from pydantic import BaseModel, Field


class ProviderInfo(BaseModel):
    name: str
    provider_type: str
    models: list[str] = Field(default_factory=list)
    is_active: bool = False
    is_healthy: bool = False


class ProviderListResponse(BaseModel):
    providers: list[ProviderInfo]


class SetActiveProviderRequest(BaseModel):
    provider_name: str
    model_name: str | None = None


class ProviderStatusResponse(BaseModel):
    name: str
    provider_type: str
    active_model: str | None = None
    is_healthy: bool
