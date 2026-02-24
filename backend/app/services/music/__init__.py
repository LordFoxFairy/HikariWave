from backend.app.services.music.inference import music_inference_service
from backend.app.services.music.pipelines import register_builtin_pipelines

register_builtin_pipelines(music_inference_service)

__all__ = ["music_inference_service"]
