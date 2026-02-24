"""ACE-Step music providers.

Two implementations are available, selected by the ``label`` field
in ``config.yaml``:

* (default, no label) — self-assembled from HuggingFace components
  (AutoModel + VAE + text encoder).  No extra package required beyond
  ``hikariwave[gpu]``.
* ``official`` — uses the official ``AceStepHandler`` from the
  ``ace-step`` Git package (``backend/vendor/ACE-Step-1.5``).
  Supports LoRA, cover, repaint, and other advanced features.
"""

from backend.app.providers.music.acestep.custom import AceStepMusicProvider
from backend.app.providers.music.acestep.official import AceStepHandlerProvider

__all__ = ["AceStepMusicProvider", "AceStepHandlerProvider"]
