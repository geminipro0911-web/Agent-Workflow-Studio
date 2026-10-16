"""Database layer for Gemini Workflow Studio (Enterprise Edition).

Provides SQLite schema initialization, connection management,
and CRUD persistence helpers for Workflows, Nodes, Edges,
Executions, Execution Nodes, File Locks, Logs, Presets, and Templates.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator

# Database file path: default to backend/workflow_studio.db
DEFAULT_DB_DIR = Path(__file__).resolve().parent
DEFAULT_DB_PATH = DEFAULT_DB_DIR / "workflow_studio.db"
DB_PATH = os.environ.get("DATABASE_PATH", str(DEFAULT_DB_PATH))

_local = threading.local()
_db_lock = threading.Lock()


def get_utc_now() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_db_connection() -> sqlite3.Connection:
    """Return a thread-local SQLite connection."""
    conn = getattr(_local, "connection", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        _local.connection = conn
    return conn


@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    """Context manager for atomic DB transactions with thread-safety."""
    with _db_lock:
        conn = get_db_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def init_database() -> None:
    """Execute SQL DDL statements from project specification to initialize schema."""
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    with db_session() as conn:
        cursor = conn.cursor()

        # 1. Agent Presets table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS agent_presets (
            id TEXT PRIMARY KEY,
            role_name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color_theme TEXT NOT NULL,
            default_system_prompt TEXT NOT NULL,
            default_allowed_paths TEXT NOT NULL,
            default_read_only_paths TEXT NOT NULL
        );
        """)

        # 2. Workflow Templates table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            layout_data TEXT NOT NULL
        );
        """)

        # 3. Workflows table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            template_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(template_id) REFERENCES workflow_templates(id)
        );
        """)

        # 4. Nodes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            preset_id TEXT,
            role_name TEXT NOT NULL,
            node_type TEXT NOT NULL,
            color_theme TEXT NOT NULL DEFAULT '#3b82f6',
            icon TEXT NOT NULL DEFAULT 'Bot',
            position_x REAL NOT NULL DEFAULT 0.0,
            position_y REAL NOT NULL DEFAULT 0.0,
            system_prompt TEXT NOT NULL DEFAULT '',
            task_prompt TEXT NOT NULL DEFAULT '',
            allowed_paths TEXT NOT NULL DEFAULT '[]',
            read_only_paths TEXT NOT NULL DEFAULT '[]',
            require_human_approval INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
            FOREIGN KEY(preset_id) REFERENCES agent_presets(id)
        );
        """)

        # 5. Edges table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            source_node_id TEXT NOT NULL,
            target_node_id TEXT NOT NULL,
            condition TEXT NOT NULL DEFAULT 'success',
            FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
            FOREIGN KEY(source_node_id) REFERENCES nodes(id) ON DELETE CASCADE,
            FOREIGN KEY(target_node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );
        """)

        # 6. Executions table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS executions (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            mock_mode INTEGER NOT NULL DEFAULT 0,
            start_time TEXT,
            end_time TEXT,
            triggered_by TEXT NOT NULL DEFAULT 'user',
            FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
        );
        """)

        # 7. Execution Nodes table (with Git Diff Audit metadata)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_nodes (
            id TEXT PRIMARY KEY,
            execution_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            error_message TEXT,
            git_pre_snapshot TEXT,
            violation_data TEXT,
            violation_action_at TEXT,
            violation_action_by TEXT,
            start_time TEXT,
            end_time TEXT,
            approved_at TEXT,
            approved_by TEXT,
            FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
            FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );
        """)

        # 8. Active File Locks table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS active_file_locks (
            id TEXT PRIMARY KEY,
            execution_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            path_pattern TEXT NOT NULL,
            locked_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
            FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );
        """)

        # 9. Execution Logs table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS execution_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            execution_id TEXT NOT NULL,
            node_id TEXT NOT NULL,
            stream_type TEXT NOT NULL,
            chunk TEXT NOT NULL,
            seq_order INTEGER NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY(execution_id) REFERENCES executions(id) ON DELETE CASCADE,
            FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
        );
        """)

        # Indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_exec_nodes_status ON execution_nodes (execution_id, status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_stream ON execution_logs (execution_id, node_id, seq_order);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_locks_lookup ON active_file_locks (execution_id, path_pattern);")
