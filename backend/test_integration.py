"""Automated Integration & System Tests for Gemini Workflow Studio Backend.

Adheres to pytest standards and validates the 3 core subsystem mechanics:
1. PathLockManager: Nested & overlapping path conflict prevention.
2. GitScopeAuditor: Snapshot capture, delta analysis, violation diff extraction, and clean rollback.
3. DAG Orchestrator: Topological sorting, dependency sequencing, and parallel branch coordination.
"""

import asyncio
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

from backend.database import db_session, init_database
from backend.git_auditor import GitScopeAuditor, is_path_allowed, normalize_posix_path
from backend.lock_manager import FileLockManager, patterns_conflict
from backend.orchestrator import DAGOrchestrator


# ============================================================================
# 1. PathLockManager Tests
# ============================================================================

class TestPathLockManagerIntegration:
    """Test virtual file path locking and nested pattern conflict detection."""

    def test_nested_patterns_conflict(self):
        """Verify that nested and parent/child directory globs conflict correctly."""
        # a) Exact requirement from prompt: backend/** and backend/routers/**
        assert patterns_conflict("backend/**", "backend/routers/**") is True
        assert patterns_conflict("backend/routers/**", "backend/**") is True

        # b) Further nested globs
        assert patterns_conflict("backend/app/**", "backend/app/api/**") is True
        assert patterns_conflict("backend/app/**", "backend/app/models/user.py") is True
        assert patterns_conflict("docs/**", "docs/architecture/adr-001.md") is True

        # c) Non-conflicting disjoint directories
        assert patterns_conflict("backend/app/**", "frontend/src/**") is False
        assert patterns_conflict("backend/migrations/**", "backend/app/models/**") is False
        assert patterns_conflict("docs/requirements/**", "docs/architecture/**") is False
        assert patterns_conflict("backend/routers/**", "backend/models/**") is False

    def test_cross_platform_path_separators(self):
        """Verify Windows backslashes and POSIX forward slashes normalize and conflict properly."""
        assert patterns_conflict("backend\\routers\\**", "backend/**") is True
        assert patterns_conflict("backend/**", "backend\\routers\\**") is True
        assert patterns_conflict("backend\\app\\**", "frontend\\src\\**") is False

    def test_acquire_and_nested_block(self):
        """Verify lock manager actively blocks an incoming node requesting a nested path."""
        lm = FileLockManager()
        exec_id = f"test_exec_{int(time.time() * 1000)}"

        # 1. Node 1 acquires parent lock on backend/**
        ok1 = lm.acquire_locks(exec_id, "node_parent", ["backend/**"])
        assert ok1 is True

        # 2. Node 2 attempts to acquire lock on nested path backend/routers/**
        can_acq, conflicts = lm.can_acquire(exec_id, "node_child", ["backend/routers/**"])
        assert can_acq is False
        assert len(conflicts) > 0
        assert "conflicts with backend/**" in conflicts[0]

        ok2 = lm.acquire_locks(exec_id, "node_child", ["backend/routers/**"])
        assert ok2 is False

        # 3. Node 3 acquires disjoint path frontend/src/** -> succeeds
        ok3 = lm.acquire_locks(exec_id, "node_frontend", ["frontend/src/**"])
        assert ok3 is True

        # 4. Node 1 releases backend/**
        released = lm.release_locks(exec_id, "node_parent")
        assert "backend/**" in released

        # 5. Node 2 can now acquire backend/routers/**
        ok2_retry = lm.acquire_locks(exec_id, "node_child", ["backend/routers/**"])
        assert ok2_retry is True

        # Clean up
        lm.clear_execution_locks(exec_id)
        assert len(lm.get_active_locks(exec_id)) == 0


# ============================================================================
# 2. GitScopeAuditor Tests (Using pytest's tmp_path fixture)
# ============================================================================

class TestGitScopeAuditorIntegration:
    """Test Git repository auditing, snapshotting, and clean rollback in temporary workspace."""

    def test_validate_git_repository(self, tmp_path: Path):
        """Verify repository validation catches missing .git and uncommitted repos."""
        auditor = GitScopeAuditor()
        project_dir = str(tmp_path)

        # 1. Non-git directory
        is_valid, msg = auditor.validate_git_repository(project_dir)
        assert is_valid is False
        assert "chưa được khởi tạo Git" in msg

        # 2. Initialized but empty git repo (no commit)
        subprocess.run(["git", "init"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "QA Bot"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "qa@example.com"], cwd=project_dir, capture_output=True, check=True)

        is_valid_no_commit, msg_no_commit = auditor.validate_git_repository(project_dir)
        assert is_valid_no_commit is False
        assert "chưa có commit đầu tiên" in msg_no_commit

        # 3. After initial commit
        readme = tmp_path / "README.md"
        readme.write_text("# Test Repo\n", encoding="utf-8")
        subprocess.run(["git", "add", "."], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Initial baseline"], cwd=project_dir, capture_output=True, check=True)

        is_valid_ok, msg_ok = auditor.validate_git_repository(project_dir)
        assert is_valid_ok is True
        assert msg_ok is None

    def test_audit_changes_and_revert_unauthorized_files(self, tmp_path: Path):
        """Simulate 1 valid edit and 1 unauthorized edit; verify detection and clean revert."""
        auditor = GitScopeAuditor()
        project_dir = str(tmp_path)

        # Initialize Git repo
        subprocess.run(["git", "init"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Auditor Test"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "auditor@test.com"], cwd=project_dir, capture_output=True, check=True)

        # Create base files
        base_readme = tmp_path / "README.md"
        base_readme.write_text("# Project Root\n", encoding="utf-8")
        base_be = tmp_path / "backend" / "app" / "main.py"
        base_be.parent.mkdir(parents=True, exist_ok=True)
        base_be.write_text("# Original backend\n", encoding="utf-8")

        subprocess.run(["git", "add", "."], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=project_dir, capture_output=True, check=True)

        # Step 1: Capture pre-execution snapshot
        snapshot = auditor.capture_snapshot(project_dir)

        # Step 2: Agent edits 1 authorized file in backend/app/
        valid_file = tmp_path / "backend" / "app" / "routes.py"
        valid_file.write_text("def get_items(): return ['item1']\n", encoding="utf-8")

        # Step 3: Agent mistakenly edits/creates 1 unauthorized file in frontend/src/
        unauthorized_file = tmp_path / "frontend" / "src" / "App.tsx"
        unauthorized_file.parent.mkdir(parents=True, exist_ok=True)
        unauthorized_file.write_text("export const UnauthorizedApp = () => <div>Hacked</div>;\n", encoding="utf-8")

        # Step 4: Audit changes against allowed paths
        allowed_paths = ["backend/app/**"]
        audit_res = auditor.audit_changes(project_dir, snapshot, allowed_paths)

        # Verify audit detection
        assert "backend/app/routes.py" in audit_res.valid_files
        assert "frontend/src/App.tsx" in audit_res.unauthorized_files
        assert len(audit_res.diffs) == 1
        assert audit_res.diffs[0]["file_path"] == "frontend/src/App.tsx"
        assert "+export const UnauthorizedApp" in audit_res.diffs[0]["diff_text"]

        # Step 5: Revert unauthorized files
        reverted = auditor.revert_unauthorized_files(project_dir, audit_res.unauthorized_files)
        assert "frontend/src/App.tsx" in reverted

        # Confirm unauthorized file was cleanly reverted/removed
        assert not unauthorized_file.exists()

        # Confirm authorized file remains untouched and valid!
        assert valid_file.exists()
        assert "def get_items():" in valid_file.read_text(encoding="utf-8")


# ============================================================================
# 3. DAG Orchestrator Topological Sort Tests
# ============================================================================

class TestDAGOrchestratorIntegration:
    """Test DAG execution sequencing and topological ordering."""

    def test_topological_execution_order(self, tmp_path: Path):
        """Validate that DAG nodes execute strictly according to dependency topological sort:
        A (Architect) -> [B (Backend) & C (Frontend)] -> D (QA Tester).
        """
        init_database()
        orchestrator = DAGOrchestrator()
        project_dir = str(tmp_path)

        # Prepare dummy git repo for workspace
        subprocess.run(["git", "init"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "DAG Test"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "dag@test.com"], cwd=project_dir, capture_output=True, check=True)
        (tmp_path / "README.md").write_text("# DAG Test\n", encoding="utf-8")
        subprocess.run(["git", "add", "."], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "init"], cwd=project_dir, capture_output=True, check=True)

        wf_id = f"wf_dag_{int(time.time() * 1000)}"
        exec_id = f"exec_dag_{int(time.time() * 1000)}"

        # 4 Nodes: node_a -> (node_b, node_c) -> node_d
        nodes = [
            {
                "id": f"{wf_id}_node_a",
                "role_name": "Architect",
                "allowed_paths": ["docs/architecture/**"],
                "task_prompt": "Define arch specs",
            },
            {
                "id": f"{wf_id}_node_b",
                "role_name": "Backend Dev",
                "allowed_paths": ["backend/**"],
                "task_prompt": "Build backend",
            },
            {
                "id": f"{wf_id}_node_c",
                "role_name": "Frontend Dev",
                "allowed_paths": ["frontend/**"],
                "task_prompt": "Build frontend",
            },
            {
                "id": f"{wf_id}_node_d",
                "role_name": "QA Tester",
                "allowed_paths": ["tests/**"],
                "task_prompt": "Verify system",
            },
        ]

        edges = [
            {"id": f"{wf_id}_e_a_b", "source_node_id": f"{wf_id}_node_a", "target_node_id": f"{wf_id}_node_b"},
            {"id": f"{wf_id}_e_a_c", "source_node_id": f"{wf_id}_node_a", "target_node_id": f"{wf_id}_node_c"},
            {"id": f"{wf_id}_e_b_d", "source_node_id": f"{wf_id}_node_b", "target_node_id": f"{wf_id}_node_d"},
            {"id": f"{wf_id}_e_c_d", "source_node_id": f"{wf_id}_node_c", "target_node_id": f"{wf_id}_node_d"},
        ]

        # Insert workflow and execution into database
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO workflows (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (wf_id, "DAG Ordering Test", "Topological test", "2026-10-16", "2026-10-16")
            )
            cursor.execute(
                "INSERT INTO executions (id, workflow_id, status, mock_mode, start_time) VALUES (?, ?, 'pending', 1, ?)",
                (exec_id, wf_id, "2026-10-16T12:00:00Z")
            )
            for n in nodes:
                cursor.execute(
                    """
                    INSERT INTO nodes (
                        id, workflow_id, preset_id, role_name, node_type,
                        color_theme, icon, position_x, position_y,
                        system_prompt, task_prompt, allowed_paths, read_only_paths,
                        require_human_approval
                    ) VALUES (?, ?, NULL, ?, 'custom', '#fff', 'Bot', 0, 0, 'prompt', ?, ?, '[]', 0)
                    """,
                    (n["id"], wf_id, n["role_name"], n["task_prompt"], json.dumps(n["allowed_paths"]))
                )
            for e in edges:
                cursor.execute(
                    "INSERT INTO edges (id, workflow_id, source_node_id, target_node_id, condition) VALUES (?, ?, ?, ?, 'success')",
                    (e["id"], wf_id, e["source_node_id"], e["target_node_id"])
                )

        async def _run():
            await orchestrator._execute_workflow(
                execution_id=exec_id,
                workflow_id=wf_id,
                mock_mode=True,
                env_vars={"WORKSPACE_DIR": project_dir}
            )

        asyncio.run(_run())


        # Inspect execution logs and completion timestamps from database
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM execution_nodes WHERE execution_id = ?", (exec_id,))
            rows = cursor.fetchall()
            status_map = {r["node_id"]: r["status"] for r in rows}
            start_times = {r["node_id"]: r["start_time"] for r in rows}
            end_times = {r["node_id"]: r["end_time"] for r in rows}

        # 1. All 4 nodes must be completed
        for n in nodes:
            assert status_map[n["id"]] == "completed", f"Node {n['id']} status was {status_map.get(n['id'])}"

        # 2. Node A completed before Node B and Node C started
        assert end_times[f"{wf_id}_node_a"] <= start_times[f"{wf_id}_node_b"]
        assert end_times[f"{wf_id}_node_a"] <= start_times[f"{wf_id}_node_c"]

        # 3. Node D started only after both Node B and Node C completed
        assert end_times[f"{wf_id}_node_b"] <= start_times[f"{wf_id}_node_d"]
        assert end_times[f"{wf_id}_node_c"] <= start_times[f"{wf_id}_node_d"]
