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


# ---- LLM config management schemas ----


class LLMProviderEntry(BaseModel):
    name: str
    type: str  # "openrouter", "ollama", "openai_compat"
    base_url: str = ""
    api_key: str = ""
    models: list[str] = Field(default_factory=list)


class LLMRouterConfig(BaseModel):
    default: str = ""
    lyrics: str = ""
    enhancement: str = ""
    suggestion: str = ""
    cover_art: str = ""


class LLMConfigResponse(BaseModel):
    providers: list[LLMProviderEntry]
    router: dict[str, str]


class LLMConfigUpdateRequest(BaseModel):
    providers: list[LLMProviderEntry]
    router: dict[str, str]


class LLMTestRequest(BaseModel):
    type: str  # "openrouter", "ollama", "openai_compat"
    base_url: str
    api_key: str = ""
    model: str = ""


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    models: list[str] = Field(default_factory=list)


class OllamaStatusResponse(BaseModel):
    available: bool
    models: list[str] = Field(default_factory=list)
