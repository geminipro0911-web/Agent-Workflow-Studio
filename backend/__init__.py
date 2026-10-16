"""Gemini Workflow Studio backend package."""

import sys
from pathlib import Path

# Ensure backend directory and its parent are on sys.path
_current_dir = Path(__file__).resolve().parent
_parent_dir = _current_dir.parent
for d in (_parent_dir, _current_dir):
    s = str(d)
    if s not in sys.path:
        sys.path.insert(0, s)
