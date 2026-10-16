"""DAG Orchestrator for Gemini Workflow Studio (Enterprise Multi-Agent Edition).

Controls DAG execution, coordinates parallel node scheduling, enforces path locking,
triggers Automated Git Diff Audit after each node finishes, pauses execution on violations,
broadcasts WebSocket alerts, and handles Revert/Approve actions to resume DAG branches.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from fastapi import WebSocket

try:
    from backend.cli_runner import cli_runner
    from backend.database import db_session, get_utc_now
    from backend.git_auditor import GitScopeAuditor
    from backend.lock_manager import lock_manager
except ImportError:
    from cli_runner import cli_runner
    from database import db_session, get_utc_now
    from git_auditor import GitScopeAuditor
    from lock_manager import lock_manager


class WebSocketHub:
    """Manages active WebSocket connections by execution ID."""

    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, execution_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(execution_id, set()).add(websocket)

    async def disconnect(self, execution_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(execution_id, set())
            conns.discard(websocket)
            if not conns and execution_id in self._connections:
                del self._connections[execution_id]

    async def broadcast(self, execution_id: str, message: Dict[str, Any]) -> None:
        """Broadcast JSON message to all WebSocket clients watching this execution."""
        async with self._lock:
            conns = list(self._connections.get(execution_id, set()))

        dead_sockets: List[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                conns = self._connections.get(execution_id, set())
                for ws in dead_sockets:
                    conns.discard(ws)


ws_hub = WebSocketHub()


class DAGOrchestrator:
    """Coordinates multi-agent DAG workflow execution."""

    def __init__(self):
        self.auditor = GitScopeAuditor()
        # Active execution tasks: execution_id -> asyncio.Task
        self._running_tasks: Dict[str, asyncio.Task] = {}
        # Violation events: execution_id -> {node_id: asyncio.Event}
        self._violation_events: Dict[str, Dict[str, asyncio.Event]] = {}
        # Violation resolution payload: execution_id -> {node_id: resolution_dict}
        self._violation_resolutions: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Pre-execution approval events: execution_id -> {node_id: asyncio.Event}
        self._approval_events: Dict[str, Dict[str, asyncio.Event]] = {}
        # Pre-execution approval resolution: execution_id -> {node_id: {"approved": bool, ...}}
        self._approval_resolutions: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Lock wait condition: execution_id -> asyncio.Condition
        self._lock_conditions: Dict[str, asyncio.Condition] = {}
        # Track violations resolved count
        self._violations_resolved_count: Dict[str, int] = {}

    async def start_execution(
        self,
        execution_id: str,
        workflow_id: str,
        mock_mode: bool = True,
        environment_vars: Optional[Dict[str, str]] = None,
    ) -> None:
        """Launch execution in a background asyncio task."""
        env_vars = environment_vars or {}
        task = asyncio.create_task(
            self._execute_workflow(execution_id, workflow_id, mock_mode, env_vars)
        )
        self._running_tasks[execution_id] = task

    async def stop_execution(self, execution_id: str) -> bool:
        """Emergency stop an execution session, terminating process trees, releasing locks and cancelling tasks."""
        # 1. Kill any running OS subprocess tree immediately
        cli_runner.kill_execution_processes(execution_id)

        # 2. Cancel running asyncio task
        task = self._running_tasks.get(execution_id)
        if task and not task.done():
            task.cancel()

        lock_manager.clear_execution_locks(execution_id)

        # Release any waiting events
        for evt in self._violation_events.get(execution_id, {}).values():
            evt.set()
        for evt in self._approval_events.get(execution_id, {}).values():
            evt.set()

        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE executions SET status = 'stopped', end_time = ? WHERE id = ?",
                (get_utc_now(), execution_id)
            )

        await ws_hub.broadcast(execution_id, {
            "type": "workflow_status_update",
            "execution_id": execution_id,
            "timestamp": get_utc_now(),
            "payload": {
                "status": "stopped",
                "summary": None,
            }
        })
        return True

    def resolve_violation(
        self,
        execution_id: str,
        node_id: str,
        action: str,  # 'reverted' | 'approved'
        actor: str,
        note: str = ""
    ) -> bool:
        """Wake up a node suspended in VIOLATION_PAUSED state."""
        evt = self._violation_events.get(execution_id, {}).get(node_id)
        if not evt:
            return False

        self._violation_resolutions.setdefault(execution_id, {})[node_id] = {
            "action": action,
            "actor": actor,
            "note": note,
            "timestamp": get_utc_now(),
        }
        evt.set()
        return True

    def resolve_approval(
        self,
        execution_id: str,
        node_id: str,
        approved: bool,
        actor: str,
        note: str = ""
    ) -> bool:
        """Wake up a node suspended in WAITING_APPROVAL state."""
        evt = self._approval_events.get(execution_id, {}).get(node_id)
        if not evt:
            return False

        self._approval_resolutions.setdefault(execution_id, {})[node_id] = {
            "approved": approved,
            "actor": actor,
            "note": note,
            "timestamp": get_utc_now(),
        }
        evt.set()
        return True

    async def _execute_workflow(
        self,
        execution_id: str,
        workflow_id: str,
        mock_mode: bool,
        env_vars: Dict[str, str],
    ) -> None:
        """Execute the DAG workflow from start to finish."""
        start_time_iso = get_utc_now()
        start_ts = time.time()
        self._violations_resolved_count[execution_id] = 0
        cond = asyncio.Condition()
        self._lock_conditions[execution_id] = cond
        completed_valid_files: Set[str] = set()

        # Resolve workspace directory
        workspace_dir = env_vars.get("WORKSPACE_DIR")
        if not workspace_dir:
            # Default to project root (parent directory of backend)
            workspace_dir = str(Path(__file__).resolve().parent.parent)

        # Validate git repository
        is_git_valid, git_err = self.auditor.validate_git_repository(workspace_dir)
        if not is_git_valid:
            await ws_hub.broadcast(execution_id, {
                "type": "error_notification",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "error_code": "GIT_REPO_INVALID",
                    "message": git_err,
                }
            })
            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE executions SET status = 'failed', end_time = ? WHERE id = ?",
                    (get_utc_now(), execution_id)
                )
            await ws_hub.broadcast(execution_id, {
                "type": "workflow_status_update",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "status": "failed",
                    "summary": {
                        "total_nodes": 0,
                        "completed_nodes": 0,
                        "failed_nodes": 0,
                        "violations_resolved": 0,
                        "duration_seconds": round(time.time() - start_ts, 2),
                    }
                }
            })
            return

        # Load nodes and edges from database
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM nodes WHERE workflow_id = ?", (workflow_id,))
            node_rows = cursor.fetchall()
            cursor.execute("SELECT * FROM edges WHERE workflow_id = ?", (workflow_id,))
            edge_rows = cursor.fetchall()

            # Update execution status to running
            cursor.execute(
                "UPDATE executions SET status = 'running', start_time = ? WHERE id = ?",
                (start_time_iso, execution_id)
            )

            # Initialize execution_nodes rows
            for n in node_rows:
                cursor.execute(
                    """
                    INSERT INTO execution_nodes (id, execution_id, node_id, status)
                    VALUES (?, ?, ?, 'pending')
                    """,
                    (f"{execution_id}_{n['id']}", execution_id, n["id"])
                )

        nodes: Dict[str, Dict[str, Any]] = {}
        for row in node_rows:
            nodes[row["id"]] = {
                "id": row["id"],
                "role_name": row["role_name"],
                "preset_id": row["preset_id"],
                "node_type": row["node_type"],
                "system_prompt": row["system_prompt"],
                "task_prompt": row["task_prompt"],
                "allowed_paths": json.loads(row["allowed_paths"] or "[]"),
                "read_only_paths": json.loads(row["read_only_paths"] or "[]"),
                "require_human_approval": bool(row["require_human_approval"]),
            }

        # Build DAG adjacency
        downstream: Dict[str, List[str]] = {nid: [] for nid in nodes}
        upstream: Dict[str, List[str]] = {nid: [] for nid in nodes}
        in_degrees: Dict[str, int] = {nid: 0 for nid in nodes}

        for edge in edge_rows:
            src = edge["source_node_id"]
            tgt = edge["target_node_id"]
            if src in nodes and tgt in nodes:
                downstream[src].append(tgt)
                upstream[tgt].append(src)
                in_degrees[tgt] += 1

        node_states: Dict[str, str] = {nid: "pending" for nid in nodes}
        node_tasks: Dict[str, asyncio.Task] = {}
        dag_lock = asyncio.Lock()
        has_failed = False

        async def _run_node_worker_inner(node_id: str) -> None:
            nonlocal has_failed
            node_data = nodes[node_id]

            # 1. Pre-Execution Human Approval Gate
            if node_data["require_human_approval"]:
                node_states[node_id] = "waiting_approval"
                self._update_node_status_in_db(execution_id, node_id, "waiting_approval")
                await ws_hub.broadcast(execution_id, {
                    "type": "approval_requested",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "role_name": node_data["role_name"],
                        "task_prompt": node_data["task_prompt"],
                        "allowed_paths": node_data["allowed_paths"],
                    }
                })
                await ws_hub.broadcast(execution_id, {
                    "type": "node_status_update",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "previous_status": "pending",
                        "current_status": "waiting_approval",
                        "error_message": None,
                    }
                })

                approval_evt = asyncio.Event()
                self._approval_events.setdefault(execution_id, {})[node_id] = approval_evt
                await approval_evt.wait()

                approval_res = self._approval_resolutions.get(execution_id, {}).get(node_id, {})
                if not approval_res.get("approved", False):
                    node_states[node_id] = "rejected"
                    self._update_node_status_in_db(execution_id, node_id, "rejected", approved_by=approval_res.get("actor"))
                    await ws_hub.broadcast(execution_id, {
                        "type": "node_status_update",
                        "execution_id": execution_id,
                        "timestamp": get_utc_now(),
                        "payload": {
                            "node_id": node_id,
                            "previous_status": "waiting_approval",
                            "current_status": "rejected",
                            "error_message": "Node rejected by user.",
                        }
                    })
                    has_failed = True
                    return

            # 2. Virtual File Lock Acquisition
            node_states[node_id] = "queued_lock"
            self._update_node_status_in_db(execution_id, node_id, "queued_lock")
            await ws_hub.broadcast(execution_id, {
                "type": "node_status_update",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "node_id": node_id,
                    "previous_status": "pending",
                    "current_status": "queued_lock",
                    "error_message": None,
                }
            })

            # Wait until lock is available
            async with cond:
                while not lock_manager.acquire_locks(execution_id, node_id, node_data["allowed_paths"]):
                    await cond.wait()

            await ws_hub.broadcast(execution_id, {
                "type": "lock_acquired",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "node_id": node_id,
                    "locked_paths": node_data["allowed_paths"],
                }
            })

            # 3. Pre-run Git Snapshot
            pre_snapshot = self.auditor.capture_snapshot(workspace_dir)
            with db_session() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    UPDATE execution_nodes
                    SET git_pre_snapshot = ?, start_time = ?, status = 'running'
                    WHERE execution_id = ? AND node_id = ?
                    """,
                    (json.dumps(pre_snapshot), get_utc_now(), execution_id, node_id)
                )

            node_states[node_id] = "running"
            await ws_hub.broadcast(execution_id, {
                "type": "node_status_update",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "node_id": node_id,
                    "previous_status": "queued_lock",
                    "current_status": "running",
                    "error_message": None,
                }
            })

            # Terminal log callback
            async def on_terminal_log(stream_type: str, chunk: str, seq_order: int) -> None:
                # Save to database
                with db_session() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        INSERT INTO execution_logs (execution_id, node_id, stream_type, chunk, seq_order, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (execution_id, node_id, stream_type, chunk, seq_order, get_utc_now())
                    )
                # Broadcast via WebSocket
                await ws_hub.broadcast(execution_id, {
                    "type": "terminal_log",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "stream_type": stream_type,
                        "chunk": chunk,
                        "seq_order": seq_order,
                    }
                })

            # 4. Execute CLI Process (Real or Mock)
            simulate_violation = (
                env_vars.get("SIMULATE_VIOLATION", "").lower() in ("true", "1") or
                node_data.get("simulate_violation", False) or
                "[SIMULATE_VIOLATION]" in node_data.get("task_prompt", "")
            )

            success = await cli_runner.run_node(
                node=node_data,
                workspace_dir=workspace_dir,
                on_log=on_terminal_log,
                mock_mode=mock_mode,
                simulate_violation=simulate_violation,
                execution_id=execution_id,
            )

            if not success:
                # Execution failed
                node_states[node_id] = "failed"
                self._update_node_status_in_db(execution_id, node_id, "failed", error_message="CLI execution failed")
                lock_manager.release_locks(execution_id, node_id)
                async with cond:
                    cond.notify_all()
                await ws_hub.broadcast(execution_id, {
                    "type": "node_status_update",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "previous_status": "running",
                        "current_status": "failed",
                        "error_message": "CLI execution failed with non-zero exit code.",
                    }
                })
                has_failed = True
                return

            # 5. Post-run Git Diff Audit
            # Collect active locks from other concurrent nodes in this execution
            other_active_locks = []
            for active_lock in lock_manager.get_active_locks(execution_id):
                if active_lock["node_id"] != node_id:
                    other_active_locks.append(active_lock["path_pattern"])

            audit_res = self.auditor.audit_changes(
                project_dir=workspace_dir,
                snapshot=pre_snapshot,
                allowed_paths=node_data["allowed_paths"],
                ignored_paths=other_active_locks,
                already_verified_files=list(completed_valid_files),
            )

            # Check if any unauthorized files were modified or created
            if audit_res.unauthorized_files:
                node_states[node_id] = "violation_paused"
                violation_data = {
                    "unauthorized_files": audit_res.unauthorized_files,
                    "diffs": audit_res.diffs,
                    "detected_at": get_utc_now(),
                }
                with db_session() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        UPDATE execution_nodes
                        SET status = 'violation_paused',
                            violation_data = ?,
                            error_message = ?
                        WHERE execution_id = ? AND node_id = ?
                        """,
                        (
                            json.dumps(violation_data),
                            f"Scope boundary violation: {len(audit_res.unauthorized_files)} unauthorized file(s) modified.",
                            execution_id,
                            node_id
                        )
                    )

                # Broadcast scope_violation_alert
                await ws_hub.broadcast(execution_id, {
                    "type": "scope_violation_alert",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "role_name": node_data["role_name"],
                        "allowed_paths": node_data["allowed_paths"],
                        "unauthorized_files": audit_res.unauthorized_files,
                        "diffs": audit_res.diffs,
                        "detected_at": get_utc_now(),
                    }
                })

                await ws_hub.broadcast(execution_id, {
                    "type": "node_status_update",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "previous_status": "running",
                        "current_status": "violation_paused",
                        "error_message": f"Agent modified {len(audit_res.unauthorized_files)} file(s) outside allowed_paths.",
                    }
                })

                # Suspend until user resolves via Revert or Approve API
                violation_evt = asyncio.Event()
                self._violation_events.setdefault(execution_id, {})[node_id] = violation_evt
                await violation_evt.wait()

                # Process user action
                res = self._violation_resolutions.get(execution_id, {}).get(node_id, {})
                action = res.get("action", "reverted")
                actor = res.get("actor", "user")

                if action == "reverted":
                    self.auditor.revert_unauthorized_files(workspace_dir, audit_res.unauthorized_files)

                self._violations_resolved_count[execution_id] += 1
                with db_session() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        """
                        UPDATE execution_nodes
                        SET violation_action_at = ?, violation_action_by = ?
                        WHERE execution_id = ? AND node_id = ?
                        """,
                        (get_utc_now(), f"{actor} ({action})", execution_id, node_id)
                    )

            # 6. Node Completed Successfully
            node_states[node_id] = "completed"
            completed_valid_files.update(audit_res.valid_files)
            self._update_node_status_in_db(execution_id, node_id, "completed", end_time=get_utc_now())

            # Release virtual file locks
            released = lock_manager.release_locks(execution_id, node_id)
            async with cond:
                cond.notify_all()

            await ws_hub.broadcast(execution_id, {
                "type": "lock_released",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "node_id": node_id,
                    "released_paths": released,
                }
            })

            await ws_hub.broadcast(execution_id, {
                "type": "node_status_update",
                "execution_id": execution_id,
                "timestamp": get_utc_now(),
                "payload": {
                    "node_id": node_id,
                    "previous_status": "running",
                    "current_status": "completed",
                    "error_message": None,
                }
            })

            # 7. Trigger downstream dependent nodes
            async with dag_lock:
                for down_id in downstream.get(node_id, []):
                    in_degrees[down_id] -= 1
                    if in_degrees[down_id] == 0 and not has_failed:
                        node_tasks[down_id] = asyncio.create_task(run_node_worker(down_id))
        async def run_node_worker(node_id: str) -> None:
            nonlocal has_failed
            try:
                await _run_node_worker_inner(node_id)
            except Exception as e:
                has_failed = True
                node_states[node_id] = "failed"
                self._update_node_status_in_db(execution_id, node_id, "failed", error_message=str(e))
                lock_manager.release_locks(execution_id, node_id)
                async with cond:
                    cond.notify_all()
                await ws_hub.broadcast(execution_id, {
                    "type": "node_status_update",
                    "execution_id": execution_id,
                    "timestamp": get_utc_now(),
                    "payload": {
                        "node_id": node_id,
                        "previous_status": node_states.get(node_id, "running"),
                        "current_status": "failed",
                        "error_message": str(e),
                    }
                })

        # Launch initial root nodes (in_degree == 0)
        root_nodes = [nid for nid, deg in in_degrees.items() if deg == 0]
        for r_nid in root_nodes:
            node_tasks[r_nid] = asyncio.create_task(run_node_worker(r_nid))

        # Wait until all node tasks complete (with timeout safeguard)
        wait_start = time.time()
        while True:
            await asyncio.sleep(0.3)
            # Inspect background tasks for unexpected exceptions
            for nid, t in list(node_tasks.items()):
                if t.done() and not t.cancelled():
                    exc = t.exception()
                    if exc:
                        has_failed = True
                        node_states[nid] = "failed"
                        self._update_node_status_in_db(execution_id, nid, "failed", error_message=str(exc))
                        lock_manager.release_locks(execution_id, nid)
                        async with cond:
                            cond.notify_all()

            # Check if all nodes reached terminal status
            terminal_states = {"completed", "failed", "rejected", "skipped"}
            all_done = all(st in terminal_states for st in node_states.values())
            if all_done or has_failed:
                break

            if time.time() - wait_start > 120:
                has_failed = True
                break

        # If any node failed, mark pending ones as skipped
        if has_failed:
            for nid, st in node_states.items():
                if st in ("pending", "queued_lock"):
                    node_states[nid] = "skipped"
                    self._update_node_status_in_db(execution_id, nid, "skipped")

        # Compute summary
        total_nodes = len(nodes)
        completed_nodes = sum(1 for st in node_states.values() if st == "completed")
        failed_nodes = sum(1 for st in node_states.values() if st in ("failed", "rejected"))
        duration_sec = round(time.time() - start_ts, 2)
        final_status = "completed" if failed_nodes == 0 else "failed"

        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE executions SET status = ?, end_time = ? WHERE id = ?",
                (final_status, get_utc_now(), execution_id)
            )

        summary = {
            "total_nodes": total_nodes,
            "completed_nodes": completed_nodes,
            "failed_nodes": failed_nodes,
            "violations_resolved": self._violations_resolved_count.get(execution_id, 0),
            "duration_seconds": duration_sec,
        }

        await ws_hub.broadcast(execution_id, {
            "type": "workflow_status_update",
            "execution_id": execution_id,
            "timestamp": get_utc_now(),
            "payload": {
                "status": final_status,
                "summary": summary,
            }
        })

    def _update_node_status_in_db(
        self,
        execution_id: str,
        node_id: str,
        status: str,
        error_message: Optional[str] = None,
        end_time: Optional[str] = None,
        approved_by: Optional[str] = None,
    ) -> None:
        """Update node status and metadata in the database."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE execution_nodes
                SET status = ?,
                    error_message = COALESCE(?, error_message),
                    end_time = COALESCE(?, end_time),
                    approved_by = COALESCE(?, approved_by)
                WHERE execution_id = ? AND node_id = ?
                """,
                (status, error_message, end_time, approved_by, execution_id, node_id)
            )


# Global DAG orchestrator singleton
orchestrator = DAGOrchestrator()
