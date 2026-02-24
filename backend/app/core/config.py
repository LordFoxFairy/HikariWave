import logging
import os
import re
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
load_dotenv(ENV_PATH)

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND_ROOT / "config.yaml"


def _resolve_env_vars(value: str) -> str:
    pattern = re.compile(r"\$\{(\w+)\}")

    def replacer(match: re.Match) -> str:
        var_name = match.group(1)
        value = os.environ.get(var_name, "")
        if not value:
            logger.warning("Environment variable %s is not set", var_name)
        return value

    return pattern.sub(replacer, value)


def _walk_and_resolve(obj: Any) -> Any:
    if isinstance(obj, str):
        return _resolve_env_vars(obj)
    if isinstance(obj, dict):
        return {k: _walk_and_resolve(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_walk_and_resolve(item) for item in obj]
    return obj


def load_yaml_config(path: Path | None = None) -> dict:
    config_path = path or CONFIG_PATH
    if not config_path.exists():
        return {}
    with config_path.open() as f:
        raw = yaml.safe_load(f) or {}
    return _walk_and_resolve(raw)


def load_raw_yaml_config(path: Path | None = None) -> dict:
    """Load config.yaml without resolving env vars (for editing/saving)."""
    config_path = path or CONFIG_PATH
    if not config_path.exists():
        return {}
    with config_path.open() as f:
        return yaml.safe_load(f) or {}


def save_yaml_config(config: dict, path: Path | None = None) -> None:
    """Save config dict back to config.yaml."""
    config_path = path or CONFIG_PATH
    with config_path.open("w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
