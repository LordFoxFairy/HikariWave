from backend.app.services.config_service import (
    provider_config_service as _provider_service,
)
from backend.app.services.music_generation import (
    generation_service as _generation_service,
)
from backend.app.services.llm_service import llm_service as _llm_service
from backend.app.services.model_marketplace import (
    marketplace_service as _marketplace_service,
)


def get_generation_service():
    return _generation_service


def get_llm_service():
    return _llm_service


def get_provider_service():
    return _provider_service


def get_marketplace_service():
    return _marketplace_service
