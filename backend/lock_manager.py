"""Virtual Path Lock Manager for Gemini Workflow Studio.

Coordinates path concurrency when DAG nodes execute in parallel,
preventing file race conditions and merge conflicts across agents.
"""

from __future__ import annotations

import fnmatch
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import PurePath
from typing import Any, Dict, List, Set, Tuple

try:
    from backend.database import db_session, get_utc_now
except ImportError:
    from database import db_session, get_utc_now


def normalize_pattern(pattern: str) -> str:
    """Normalize path pattern to POSIX format, strip quotes and clean whitespace."""
    cleaned = pattern.strip().strip('"').strip("'").replace("\\", "/")
    return PurePath(cleaned).as_posix()


def patterns_conflict(pattern1: str, pattern2: str) -> bool:
    """Determine whether two path patterns overlap or conflict.
    
    Examples:
    - ("backend/app/**", "backend/app/api/**") -> True
    - ("backend/app/**", "frontend/src/**") -> False
    - ("backend/migrations/**", "backend/app/models/**") -> False
    - ("docs/requirements/**", "docs/architecture/**") -> False
    """
    p1 = normalize_pattern(pattern1)
    p2 = normalize_pattern(pattern2)

    # Identical pattern
    if p1 == p2:
        return True

    # Check fnmatch wildcards
    if fnmatch.fnmatch(p1, p2) or fnmatch.fnmatch(p2, p1):
        return True

    # Compare prefix directories
    c1 = p1.rstrip('*').rstrip('/')
    c2 = p2.rstrip('*').rstrip('/')

    if c1 and c2:
        if c1 == c2:
            return True
        if c1.startswith(c2 + "/"):
            return True
        if c2.startswith(c1 + "/"):
            return True

    return False


class FileLockManager:
    """Thread-safe virtual file lock manager coordinating active node locks."""

    def __init__(self):
        self._lock = threading.Lock()
        # In-memory map: execution_id -> list of lock records
        # { "id": str, "execution_id": str, "node_id": str, "path_pattern": str, "locked_at": str }
        self._active_locks: Dict[str, List[Dict[str, Any]]] = {}

    def can_acquire(
        self,
        execution_id: str,
        node_id: str,
        requested_patterns: List[str]
    ) -> Tuple[bool, List[str]]:
        """Check if the requested path patterns can be locked without conflict.
        
        Returns:
            Tuple[bool, List[str]]: (can_acquire, conflicting_patterns)
        """
        with self._lock:
            existing = self._active_locks.get(execution_id, [])
            conflicts: List[str] = []

            for req in requested_patterns:
                for active in existing:
                    # Ignore locks already held by this same node
                    if active["node_id"] == node_id:
                        continue
                    if patterns_conflict(req, active["path_pattern"]):
                        conflicts.append(f"{req} conflicts with {active['path_pattern']} held by node {active['node_id']}")

            return len(conflicts) == 0, conflicts

    def acquire_locks(
        self,
        execution_id: str,
        node_id: str,
        patterns: List[str]
    ) -> bool:
        """Attempt to acquire virtual file locks for all specified patterns.
        
        Returns:
            bool: True if successfully acquired; False if a conflict exists.
        """
        if not patterns:
            return True

        with self._lock:
            existing = self._active_locks.setdefault(execution_id, [])

            # Check for conflict with other nodes
            for req in patterns:
                for active in existing:
                    if active["node_id"] == node_id:
                        continue
                    if patterns_conflict(req, active["path_pattern"]):
                        return False

            # No conflicts: register locks in memory and in SQLite
            now_iso = get_utc_now()
            new_records = []
            for pat in patterns:
                lock_id = str(uuid.uuid4())
                record = {
                    "id": lock_id,
                    "execution_id": execution_id,
                    "node_id": node_id,
                    "path_pattern": normalize_pattern(pat),
                    "locked_at": now_iso,
                }
                existing.append(record)
                new_records.append(record)

            # Persist to database if rows exist
            try:
                with db_session() as conn:
                    cursor = conn.cursor()
                    for r in new_records:
                        cursor.execute(
                            """
                            INSERT INTO active_file_locks (id, execution_id, node_id, path_pattern, locked_at)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (r["id"], r["execution_id"], r["node_id"], r["path_pattern"], r["locked_at"])
                        )
            except sqlite3.IntegrityError:
                # Parent execution or node does not exist in DB (e.g. standalone unit tests), retain in-memory lock
                pass
            except Exception:
                # If unexpected DB insert fails, rollback in-memory locks
                for r in new_records:
                    if r in existing:
                        existing.remove(r)
                raise

            return True

    def release_locks(self, execution_id: str, node_id: str) -> List[str]:
        """Release all active locks held by a specific node.
        
        Returns:
            List[str]: The released path patterns.
        """
        with self._lock:
            existing = self._active_locks.get(execution_id, [])
            released_patterns: List[str] = []
            remaining: List[Dict[str, Any]] = []

            for r in existing:
                if r["node_id"] == node_id:
                    released_patterns.append(r["path_pattern"])
                else:
                    remaining.append(r)

            self._active_locks[execution_id] = remaining

            # Remove from database
            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "DELETE FROM active_file_locks WHERE execution_id = ? AND node_id = ?",
                    (execution_id, node_id)
                )

            return released_patterns

    def get_active_locks(self, execution_id: str) -> List[Dict[str, Any]]:
        """Return a copy of all active locks for an execution session."""
        with self._lock:
            return list(self._active_locks.get(execution_id, []))

    def clear_execution_locks(self, execution_id: str) -> None:
        """Clear all active locks for an execution (e.g., on abort or complete)."""
        with self._lock:
            self._active_locks.pop(execution_id, None)
            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM active_file_locks WHERE execution_id = ?", (execution_id,))


# Global lock manager singleton
lock_manager = FileLockManager()
