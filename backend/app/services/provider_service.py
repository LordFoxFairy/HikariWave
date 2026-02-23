from backend.app.providers.manager import provider_manager


class ProviderService:
    """Thin wrapper around provider_manager for listing providers.

    API endpoints call this service instead of importing provider_manager directly.
    """

    def list_llm_providers(self) -> list[dict]:
        return provider_manager.list_llm_providers()

    def list_music_providers(self) -> list[dict]:
        return provider_manager.list_music_providers()

    def list_image_providers(self) -> list[dict]:
        return provider_manager.list_image_providers()


provider_service = ProviderService()
