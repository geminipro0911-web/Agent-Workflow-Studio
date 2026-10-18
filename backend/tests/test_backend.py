"""Comprehensive automated test suite for Gemini Workflow Studio Backend.

Tests:
1. Presets and Templates configuration
2. GitScopeAuditor (snapshot, audit_changes, diff extraction, safe rollback)
3. Virtual FileLockManager (pattern overlap, acquire, release)
4. CLIRunner (mock mode, prompt injector, violation simulation)
5. DAGOrchestrator (parallel execution, violation pause, event resume)
6. FastAPI REST & WebSocket Endpoints (via TestClient)
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.cli_runner import CLIRunner, inject_strict_scope_rules
from backend.database import db_session, init_database
from backend.git_auditor import GitScopeAuditor, is_path_allowed
from backend.lock_manager import FileLockManager, patterns_conflict
from backend.main import app
from backend.orchestrator import DAGOrchestrator
from backend.presets import (
    ENTERPRISE_AGENT_PRESETS,
    PRESET_MAP,
    TEMPLATE_MAP,
    WORKFLOW_TEMPLATES,
    seed_presets_and_templates,
)


class TestPresets(unittest.TestCase):
    """Test 7 Enterprise Presets and 3 Workflow Templates."""

    def test_seven_presets_exist(self):
        self.assertEqual(len(ENTERPRISE_AGENT_PRESETS), 7)
        expected_keys = {"pm", "architect", "database", "backend", "frontend", "qa", "security"}
        actual_keys = {p["id"] for p in ENTERPRISE_AGENT_PRESETS}
        self.assertEqual(expected_keys, actual_keys)

        for p in ENTERPRISE_AGENT_PRESETS:
            self.assertTrue(len(p["role_name"]) > 0)
            self.assertTrue(len(p["icon"]) > 0)
            self.assertTrue(p["color_theme"].startswith("#"))
            self.assertTrue(len(p["default_system_prompt"]) > 50)
            self.assertIsInstance(p["default_allowed_paths"], list)
            self.assertIsInstance(p["default_read_only_paths"], list)
            self.assertTrue(len(p["default_allowed_paths"]) > 0)

    def test_workflow_templates(self):
        self.assertEqual(len(WORKFLOW_TEMPLATES), 10)
        expected_templates = {
            "fullstack_sdlc",
            "fast_feature",
            "bug_hotfix",
            "feature_update",
            "security_audit",
            "code_review_refactor",
            "db_migration_audit",
            "monolith_modularization",
            "spaghetti_layered_refactor",
            "legacy_cleanup_modernization",
        }
        actual_templates = {t["id"] for t in WORKFLOW_TEMPLATES}
        self.assertEqual(expected_templates, actual_templates)

        for t in WORKFLOW_TEMPLATES:
            self.assertTrue(t["nodes_count"] > 0)
            self.assertTrue(t["edges_count"] > 0)
            layout = t["layout_data"]
            self.assertEqual(len(layout["nodes"]), t["nodes_count"])
            self.assertEqual(len(layout["edges"]), t["edges_count"])

        # Check fullstack_sdlc has 7 nodes and 7 edges
        fs = TEMPLATE_MAP["fullstack_sdlc"]
        self.assertEqual(fs["nodes_count"], 7)
        self.assertEqual(fs["edges_count"], 7)

        # Check feature_update has 5 nodes and 5 edges
        fu = TEMPLATE_MAP["feature_update"]
        self.assertEqual(fu["nodes_count"], 5)
        self.assertEqual(fu["edges_count"], 5)

        # Check security_audit has 3 nodes and 2 edges
        sa = TEMPLATE_MAP["security_audit"]
        self.assertEqual(sa["nodes_count"], 3)
        self.assertEqual(sa["edges_count"], 2)

        # Check code_review_refactor has 5 nodes and 5 edges
        cr = TEMPLATE_MAP["code_review_refactor"]
        self.assertEqual(cr["nodes_count"], 5)
        self.assertEqual(cr["edges_count"], 5)

        # Check db_migration_audit has 3 nodes and 2 edges
        dbm = TEMPLATE_MAP["db_migration_audit"]
        self.assertEqual(dbm["nodes_count"], 3)
        self.assertEqual(dbm["edges_count"], 2)

        # Check monolith_modularization has 4 nodes and 3 edges
        mm = TEMPLATE_MAP["monolith_modularization"]
        self.assertEqual(mm["nodes_count"], 4)
        self.assertEqual(mm["edges_count"], 3)

        # Check spaghetti_layered_refactor has 4 nodes and 3 edges
        slr = TEMPLATE_MAP["spaghetti_layered_refactor"]
        self.assertEqual(slr["nodes_count"], 4)
        self.assertEqual(slr["edges_count"], 3)

        # Check legacy_cleanup_modernization has 4 nodes and 3 edges
        lcm = TEMPLATE_MAP["legacy_cleanup_modernization"]
        self.assertEqual(lcm["nodes_count"], 4)
        self.assertEqual(lcm["edges_count"], 3)


class TestGitScopeAuditor(unittest.TestCase):
    """Test GitScopeAuditor pattern matching, diff extraction, and rollback."""

    def setUp(self):
        self.auditor = GitScopeAuditor()
        self.temp_dir = tempfile.mkdtemp(prefix="test_git_auditor_")

        # Initialize a temporary git repository for testing
        subprocess.run(["git", "init"], cwd=self.temp_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=self.temp_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=self.temp_dir, capture_output=True, check=True)

        # Create initial baseline files
        readme = Path(self.temp_dir) / "README.md"
        readme.write_text("# Test Repo\n", encoding="utf-8")
        backend_file = Path(self.temp_dir) / "backend" / "app" / "main.py"
        backend_file.parent.mkdir(parents=True, exist_ok=True)
        backend_file.write_text("# Original Code\n", encoding="utf-8")

        subprocess.run(["git", "add", "."], cwd=self.temp_dir, capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=self.temp_dir, capture_output=True, check=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_is_path_allowed(self):
        allowed = ["backend/app/**", "docs/*.md", "api_spec.md"]

        self.assertTrue(is_path_allowed("backend/app/main.py", allowed))
        self.assertTrue(is_path_allowed("backend/app/services/auth.py", allowed))
        self.assertTrue(is_path_allowed("docs/architecture.md", allowed))
        self.assertTrue(is_path_allowed("api_spec.md", allowed))

        # Disallowed
        self.assertFalse(is_path_allowed("frontend/src/App.tsx", allowed))
        self.assertFalse(is_path_allowed("package.json", allowed))
        self.assertFalse(is_path_allowed("backend/migrations/001.py", allowed))

    def test_audit_and_revert_unauthorized_changes(self):
        # 1. Capture snapshot before run
        snapshot = self.auditor.capture_snapshot(self.temp_dir)
        self.assertEqual(snapshot, {})

        # 2. Agent creates an authorized file in backend/app/
        valid_file = Path(self.temp_dir) / "backend" / "app" / "service.py"
        valid_file.write_text("def do_service(): pass\n", encoding="utf-8")

        # 3. Agent mistakenly modifies/creates unauthorized file in frontend/src/
        unauthorized_file = Path(self.temp_dir) / "frontend" / "src" / "App.tsx"
        unauthorized_file.parent.mkdir(parents=True, exist_ok=True)
        unauthorized_file.write_text("import React from 'react';\n", encoding="utf-8")

        # 4. Audit changes against backend allowed paths
        allowed_paths = ["backend/app/**"]
        audit_res = self.auditor.audit_changes(self.temp_dir, snapshot, allowed_paths)

        self.assertIn("backend/app/service.py", audit_res.valid_files)
        self.assertIn("frontend/src/App.tsx", audit_res.unauthorized_files)
        self.assertEqual(len(audit_res.diffs), 1)
        self.assertEqual(audit_res.diffs[0]["file_path"], "frontend/src/App.tsx")
        self.assertIn("+import React from 'react';", audit_res.diffs[0]["diff_text"])

        # 5. Revert unauthorized files
        reverted = self.auditor.revert_unauthorized_files(self.temp_dir, audit_res.unauthorized_files)
        self.assertIn("frontend/src/App.tsx", reverted)

        # Verify unauthorized file was removed/reverted
        self.assertFalse(unauthorized_file.exists())

        # CRITICAL: Verify authorized file remains intact!
        self.assertTrue(valid_file.exists())
        self.assertEqual(valid_file.read_text(encoding="utf-8"), "def do_service(): pass\n")


class TestLockManager(unittest.TestCase):
    """Test Virtual Path Lock Manager."""

    def setUp(self):
        self.lm = FileLockManager()
        self.exec_id = "test_exec_001"

    def test_patterns_conflict(self):
        self.assertTrue(patterns_conflict("backend/app/**", "backend/app/models/**"))
        self.assertTrue(patterns_conflict("backend/app/**", "backend/**"))
        self.assertTrue(patterns_conflict("backend/app/main.py", "backend/app/main.py"))

        self.assertFalse(patterns_conflict("backend/app/**", "frontend/src/**"))
        self.assertFalse(patterns_conflict("docs/requirements/**", "docs/architecture/**"))
        self.assertFalse(patterns_conflict("backend/migrations/**", "backend/app/models/**"))

    def test_acquire_and_release_locks(self):
        # Node A locks backend
        ok_a = self.lm.acquire_locks(self.exec_id, "node_be", ["backend/app/**"])
        self.assertTrue(ok_a)

        # Node B requests frontend -> should succeed (no overlap)
        ok_b = self.lm.acquire_locks(self.exec_id, "node_fe", ["frontend/src/**"])
        self.assertTrue(ok_b)

        # Node C requests backend/app/models -> should FAIL (conflict with Node A)
        ok_c = self.lm.acquire_locks(self.exec_id, "node_db", ["backend/app/models/**"])
        self.assertFalse(ok_c)

        # Node A releases locks
        released = self.lm.release_locks(self.exec_id, "node_be")
        self.assertIn("backend/app/**", released)

        # Now Node C can acquire lock
        ok_c_after = self.lm.acquire_locks(self.exec_id, "node_db", ["backend/app/models/**"])
        self.assertTrue(ok_c_after)

        self.lm.clear_execution_locks(self.exec_id)
        self.assertEqual(len(self.lm.get_active_locks(self.exec_id)), 0)


class TestCLIRunner(unittest.TestCase):
    """Test CLI Runner and Prompt Injection."""

    def test_prompt_injector(self):
        injected = inject_strict_scope_rules(
            system_prompt="You are a Backend Engineer.",
            task_prompt="Build auth API.",
            allowed_paths=["backend/app/**"],
            read_only_paths=["api_spec.md"]
        )
        self.assertIn("You are a Backend Engineer.", injected)
        self.assertIn("Build auth API.", injected)
        self.assertIn("[STRICT SCOPE ENFORCEMENT RULES — MANDATORY]", injected)
        self.assertIn("backend/app/**", injected)
        self.assertIn("api_spec.md", injected)

    def test_mock_mode_execution(self):
        temp_dir = tempfile.mkdtemp(prefix="test_mock_cli_")
        try:
            runner = CLIRunner()
            logs = []

            async def on_log(st, chunk, seq):
                logs.append((st, chunk))

            node = {
                "id": "node_test_be",
                "role_name": "Backend Dev",
                "allowed_paths": ["backend/app/**"],
                "read_only_paths": ["api_spec.md"],
                "task_prompt": "Write sample backend service",
            }

            loop = asyncio.new_event_loop()
            res = loop.run_until_complete(
                runner.run_node(node, temp_dir, on_log, mock_mode=True, simulate_violation=True)
            )
            loop.close()

            self.assertTrue(res)
            log_text = "".join(chunk for _, chunk in logs)
            self.assertIn("[SYSTEM] Initializing Gemini CLI Session", log_text)
            self.assertIn("[MOCK-SIMULATOR] Intentionally modifying unauthorized path: frontend/src/App.tsx", log_text)

            # Verify files created
            self.assertTrue(os.path.exists(os.path.join(temp_dir, "frontend", "src", "App.tsx")))
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestFastAPIRoutes(unittest.TestCase):
    """Test REST API and WebSocket endpoints."""

    @classmethod
    def setUpClass(cls):
        init_database()
        seed_presets_and_templates()
        cls.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_get_presets(self):
        res = self.client.get("/api/v1/presets")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 7)

    def test_get_templates(self):
        res = self.client.get("/api/v1/templates")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(len(data["data"]), 10)

    def test_workflow_lifecycle_from_template(self):
        # 1. Create workflow from template
        create_res = self.client.post(
            "/api/v1/workflows/from-template/fast_feature",
            json={"name": "Test Feature Pipeline", "description": "Automated unit test"}
        )
        self.assertEqual(create_res.status_code, 201)
        wf = create_res.json()["data"]
        wf_id = wf["id"]
        self.assertEqual(len(wf["nodes"]), 4)
        self.assertEqual(len(wf["edges"]), 4)

        # 2. Get workflow details
        get_res = self.client.get(f"/api/v1/workflows/{wf_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["data"]["name"], "Test Feature Pipeline")

        # 3. Update workflow
        update_res = self.client.put(
            f"/api/v1/workflows/{wf_id}",
            json={"name": "Renamed Feature Pipeline"}
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["data"]["name"], "Renamed Feature Pipeline")

        # 4. Trigger execution in Mock Mode
        exec_res = self.client.post(
            f"/api/v1/workflows/{wf_id}/execute",
            json={"mock_mode": True, "environment_vars": {}}
        )
        self.assertEqual(exec_res.status_code, 202)
        exec_data = exec_res.json()["data"]
        exec_id = exec_data["execution_id"]
        self.assertEqual(exec_data["status"], "running")

        # 5. Check execution status
        status_res = self.client.get(f"/api/v1/executions/{exec_id}")
        self.assertEqual(status_res.status_code, 200)
        self.assertEqual(status_res.json()["data"]["id"], exec_id)

        # 6. Delete workflow
        del_res = self.client.delete(f"/api/v1/workflows/{wf_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["success"])

    def test_websocket_heartbeat(self):
        # Test WebSocket connection and ping/pong
        exec_id = "test_ws_exec_123"
        with self.client.websocket_connect(f"/ws/executions/{exec_id}") as ws:
            ack = ws.receive_json()
            self.assertEqual(ack["type"], "connection_ack")
            self.assertEqual(ack["execution_id"], exec_id)

            ws.send_json({"type": "ping"})
            pong = ws.receive_json()
            self.assertEqual(pong["type"], "pong")
            self.assertEqual(pong["execution_id"], exec_id)

    def test_scope_violation_pause_and_revert_flow(self):
        """End-to-end test of Scope Violation detection, pause, and Revert resolution."""
        import httpx

        async def run_flow():
            temp_dir = tempfile.mkdtemp(prefix="test_e2e_violation_")
            try:
                # Setup git repo
                subprocess.run(["git", "init"], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "config", "user.name", "Test"], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=temp_dir, capture_output=True, check=True)
                (Path(temp_dir) / "README.md").write_text("# Test\n", encoding="utf-8")
                subprocess.run(["git", "add", "."], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "commit", "-m", "init"], cwd=temp_dir, capture_output=True, check=True)

                transport = httpx.ASGITransport(app=app)
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    # 1. Create a workflow with a node configured to simulate a scope violation
                    wf_payload = {
                        "name": "Scope Violation Test WF",
                        "nodes": [
                            {
                                "id": "node_violator",
                                "preset_id": "backend",
                                "role_name": "Backend Dev",
                                "node_type": "backend",
                                "system_prompt": "You are a backend dev",
                                "task_prompt": "Implement backend code [SIMULATE_VIOLATION]",
                                "allowed_paths": ["backend/app/**"],
                                "read_only_paths": ["api_spec.md"],
                                "require_human_approval": False,
                                "simulate_violation": True
                            }
                        ],
                        "edges": []
                    }
                    create_res = await client.post("/api/v1/workflows", json=wf_payload)
                    self.assertEqual(create_res.status_code, 201)
                    wf_data = create_res.json()["data"]
                    wf_id = wf_data["id"]
                    actual_node_id = wf_data["nodes"][0]["id"]

                    # 2. Execute workflow
                    exec_res = await client.post(
                        f"/api/v1/workflows/{wf_id}/execute",
                        json={
                            "mock_mode": True,
                            "environment_vars": {"WORKSPACE_DIR": temp_dir, "SIMULATE_VIOLATION": "true"}
                        }
                    )
                    self.assertEqual(exec_res.status_code, 202)
                    exec_id = exec_res.json()["data"]["execution_id"]

                    # 3. Poll until node is in violation_paused
                    paused = False
                    for _ in range(30):
                        await asyncio.sleep(0.3)
                        st_res = await client.get(f"/api/v1/executions/{exec_id}")
                        nodes_st = st_res.json()["data"]["nodes_status"]
                        if nodes_st and nodes_st[0]["status"] == "violation_paused":
                            paused = True
                            break

                    self.assertTrue(paused, "Node should have transitioned to violation_paused")

                    # 4. Check violations endpoint
                    viol_res = await client.get(f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/violations")
                    self.assertEqual(viol_res.status_code, 200)
                    viol_data = viol_res.json()["data"]
                    self.assertIn("frontend/src/App.tsx", viol_data["unauthorized_files"])
                    self.assertTrue(len(viol_data["diffs"]) > 0)

                    # 5. Call Revert Violations API
                    rev_res = await client.post(
                        f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/revert-violations",
                        json={"reverted_by": "Test Auditor", "comment": "Reverting frontend leak"}
                    )
                    self.assertEqual(rev_res.status_code, 200)
                    self.assertEqual(rev_res.json()["data"]["action"], "reverted")

                    # 6. Poll until workflow completes
                    completed = False
                    for _ in range(30):
                        await asyncio.sleep(0.3)
                        st_res = await client.get(f"/api/v1/executions/{exec_id}")
                        if st_res.json()["data"]["status"] == "completed":
                            completed = True
                            break

                    self.assertTrue(completed, "Workflow should have resumed and completed after revert")

                    # Verify that unauthorized file is gone from disk
                    unauth_path = Path(temp_dir) / "frontend" / "src" / "App.tsx"
                    self.assertFalse(unauth_path.exists())
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        asyncio.run(run_flow())

    def test_scope_violation_pause_and_approve_flow(self):
        """End-to-end test of Scope Violation detection, pause, and Approve resolution."""
        import httpx

        async def run_flow():
            temp_dir = tempfile.mkdtemp(prefix="test_e2e_approve_")
            try:
                # Setup git repo
                subprocess.run(["git", "init"], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "config", "user.name", "Test"], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "config", "user.email", "test@test.com"], cwd=temp_dir, capture_output=True, check=True)
                (Path(temp_dir) / "README.md").write_text("# Test\n", encoding="utf-8")
                subprocess.run(["git", "add", "."], cwd=temp_dir, capture_output=True, check=True)
                subprocess.run(["git", "commit", "-m", "init"], cwd=temp_dir, capture_output=True, check=True)

                transport = httpx.ASGITransport(app=app)
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                    wf_payload = {
                        "name": "Scope Approve Test WF",
                        "nodes": [
                            {
                                "id": "node_approver",
                                "preset_id": "backend",
                                "role_name": "Backend Dev",
                                "node_type": "backend",
                                "task_prompt": "Implement backend code [SIMULATE_VIOLATION]",
                                "allowed_paths": ["backend/app/**"],
                                "require_human_approval": False,
                                "simulate_violation": True
                            }
                        ],
                        "edges": []
                    }
                    create_res = await client.post("/api/v1/workflows", json=wf_payload)
                    wf_data = create_res.json()["data"]
                    wf_id = wf_data["id"]
                    actual_node_id = wf_data["nodes"][0]["id"]

                    exec_res = await client.post(
                        f"/api/v1/workflows/{wf_id}/execute",
                        json={
                            "mock_mode": True,
                            "environment_vars": {"WORKSPACE_DIR": temp_dir, "SIMULATE_VIOLATION": "true"}
                        }
                    )
                    exec_id = exec_res.json()["data"]["execution_id"]

                    # Poll for pause
                    paused = False
                    for _ in range(30):
                        await asyncio.sleep(0.3)
                        st_res = await client.get(f"/api/v1/executions/{exec_id}")
                        nodes_st = st_res.json()["data"]["nodes_status"]
                        if nodes_st and nodes_st[0]["status"] == "violation_paused":
                            paused = True
                            break

                    self.assertTrue(paused)

                    # Approve violations
                    app_res = await client.post(
                        f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/approve-violations",
                        json={"approved_by": "Tech Lead", "reason": "Approved scope expansion"}
                    )
                    self.assertEqual(app_res.status_code, 200)
                    self.assertEqual(app_res.json()["data"]["action"], "approved")

                    # Poll for complete
                    completed = False
                    for _ in range(30):
                        await asyncio.sleep(0.3)
                        st_res = await client.get(f"/api/v1/executions/{exec_id}")
                        if st_res.json()["data"]["status"] == "completed":
                            completed = True
                            break

                    self.assertTrue(completed)

                    # Verify that unauthorized file is KEPT on disk
                    unauth_path = Path(temp_dir) / "frontend" / "src" / "App.tsx"
                    self.assertTrue(unauth_path.exists())
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)

        asyncio.run(run_flow())

    def test_empty_workflow_execution_rejected(self):
        """Test that attempting to execute a workflow with 0 nodes returns 400 Bad Request."""
        create_res = self.client.post("/api/v1/workflows", json={"name": "Zero Nodes WF", "nodes": [], "edges": []})
        self.assertEqual(create_res.status_code, 201)
        wf_id = create_res.json()["data"]["id"]

        exec_res = self.client.post(f"/api/v1/workflows/{wf_id}/execute", json={"mock_mode": True})
        self.assertEqual(exec_res.status_code, 400)
        self.assertIn("Agent Node", exec_res.json()["error"]["message"])


if __name__ == "__main__":
    unittest.main()
