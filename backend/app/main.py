"""Re-export FastAPI app for app.main entrypoint."""

try:
    from backend.main import app
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from backend.main import app

__all__ = ["app"]
