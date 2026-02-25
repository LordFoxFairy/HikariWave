from pydantic import BaseModel, Field

# ---- LLM config management schemas ----


class LLMProviderEntry(BaseModel):
    name: str
    type: str  # "openrouter", "openai_compat"
    label: str = ""
    base_url: str = ""
    api_key: str = ""
    models: list[str] = Field(default_factory=list)


class LLMConfigResponse(BaseModel):
    providers: list[LLMProviderEntry]
    router: dict[str, str]


class LLMConfigUpdateRequest(BaseModel):
    providers: list[LLMProviderEntry]
    router: dict[str, str]


class LLMTestRequest(BaseModel):
    type: str  # "openrouter", "openai_compat"
    base_url: str
    api_key: str = ""
    model: str = ""
    name: str = ""  # existing provider name, used to resolve masked api_key


class LLMTestResponse(BaseModel):
    success: bool
    message: str
    models: list[str] = Field(default_factory=list)


# ---- Music config management schemas ----


class MusicModelEntry(BaseModel):
    name: str
    label: str = ""
    model_id: str = ""
    model_kwargs: dict = Field(default_factory=dict)


class MusicProviderEntry(BaseModel):
    name: str
    type: str = "huggingface"
    label: str = ""
    models: list[MusicModelEntry] = Field(default_factory=list)


class MusicConfigResponse(BaseModel):
    providers: list[MusicProviderEntry]
    router: dict[str, str] = Field(default_factory=dict)


class MusicConfigUpdateRequest(BaseModel):
    providers: list[MusicProviderEntry]
    router: dict[str, str] = Field(default_factory=dict)
