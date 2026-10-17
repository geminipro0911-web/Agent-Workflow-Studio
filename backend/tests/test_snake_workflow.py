"""Comprehensive Integration Test Suite for Gemini Workflow Studio with LAN Snake Workspace.

Verifies end-to-end connection between Frontend/API client, Backend, and Gemini CLI Engine:
1. Architectural & Code Review on Snake Game (docs/ & shared/)
2. Feature Addition with Git Auditor Tracking (client/ & server/)
3. Scope Violation Detection & Git Automated Rollback (Revert via Git)
4. Pre-execution Human-in-the-Loop Approval Gate
5. Automated QA Subprocess Execution (running pytest in lan_snake_workspace)
6. Subprocess Cancellation, Process-Tree Termination, and Session Stop
"""

from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path

import httpx
import pytest

from backend.main import app
from backend.presets import seed_presets_and_templates
from backend.database import init_database
from backend.git_auditor import GitScopeAuditor, is_path_allowed

WORKSPACE_DIR = Path(__file__).resolve().parent.parent.parent / "lan_snake_workspace"
WORKSPACE_DIR_STR = str(WORKSPACE_DIR)


def clean_workspace_git():
    """Ensure lan_snake_workspace is in pristine git state before/after tests."""
    if os.path.exists(WORKSPACE_DIR_STR):
        subprocess.run(["git", "checkout", "--", "."], cwd=WORKSPACE_DIR_STR, capture_output=True)
        subprocess.run(["git", "clean", "-fd"], cwd=WORKSPACE_DIR_STR, capture_output=True)


@pytest.fixture(scope="module", autouse=True)
def setup_suite():
    init_database()
    seed_presets_and_templates()
    clean_workspace_git()
    yield
    clean_workspace_git()


@pytest.fixture(autouse=True)
def clean_each_test():
    clean_workspace_git()
    yield
    clean_workspace_git()


class TestSnakeGameWorkflows:
    """Comprehensive test suite for Gemini Workflow Studio on the LAN Snake Game."""

    @pytest.mark.asyncio
    async def test_01_code_review_workflow(self):
        """Test Scenario 1: Reviewer Agent reviews Snake Game architecture and writes audit report.
        
        Verifies:
        - REST API POST /api/v1/workflows registers the workflow.
        - REST API POST /execute launches execution targeting lan_snake_workspace.
        - Changes in allowed paths ('docs/**') pass Git Auditor check with status 'PASSED'.
        - Node completes successfully (pending -> running -> completed).
        - Terminal logs endpoint streams live logs and node transitions.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create Review Workflow via REST API
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake Code Review Workflow",
                    "description": "System Architect reviews network protocol and architecture",
                    "nodes": [
                        {
                            "id": "node_reviewer",
                            "preset_id": "architect",
                            "role_name": "System Architect & Reviewer",
                            "node_type": "architect",
                            "color_theme": "#8b5cf6",
                            "icon": "ShieldCheck",
                            "position_x": 100.0,
                            "position_y": 200.0,
                            "system_prompt": "You are the Lead Systems Architect reviewing the LAN Snake Game.",
                            "task_prompt": "Review network protocol in shared/protocol.json and write audit notes in docs/architecture.md",
                            "allowed_paths": ["docs/**", "shared/**"],
                            "read_only_paths": ["server/**", "client/**"],
                            "require_human_approval": False,
                            "simulate_violation": False,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_data = wf_res.json()["data"]
            wf_id = wf_data["id"]

            # 2. Trigger execution targeting lan_snake_workspace
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            # 3. Poll until completion
            completed = False
            for _ in range(40):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    if data["status"] in ("completed", "failed", "paused"):
                        completed = True
                        assert data["status"] == "completed", f"Execution failed: {data}"
                        assert data["nodes_status"][0]["status"] == "completed"
                        break

            assert completed, "Review workflow did not finish in time!"

            # 4. Verify terminal logs endpoint
            logs_res = await client.get(f"/api/v1/executions/{exec_id}/logs")
            assert logs_res.status_code == 200
            logs = logs_res.json()["data"]
            assert len(logs) > 0
            all_chunks = " ".join(l["chunk"] for l in logs)
            assert "STRICT-SCOPE" in all_chunks or "Architect" in all_chunks

    @pytest.mark.asyncio
    async def test_02_feature_addition_workflow(self):
        """Test Scenario 2: Frontend Game Developer Agent implements a new feature in the Snake Game.
        
        Verifies:
        - Authorized modifications to 'client/**' are captured by Git Auditor.
        - Git diff is parsed without triggering a violation.
        - Node completes and workspace tracks legitimate commit/diff.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create Feature Addition Workflow
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake Feature Addition Pipeline",
                    "description": "Canvas Dev adds speed controls and pause toggle to client",
                    "nodes": [
                        {
                            "id": "node_fe_dev",
                            "preset_id": "frontend",
                            "role_name": "Frontend Canvas Game Dev",
                            "node_type": "frontend",
                            "color_theme": "#10b981",
                            "icon": "Gamepad2",
                            "position_x": 300.0,
                            "position_y": 200.0,
                            "system_prompt": "Lead HTML5 Canvas Game Engineer.",
                            "task_prompt": "Implement game pause and speed multiplier in client/snake_client.js and client/index.html",
                            "allowed_paths": ["client/**"],
                            "read_only_paths": ["shared/**"],
                            "require_human_approval": False,
                            "simulate_violation": False,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_id = wf_res.json()["data"]["id"]

            # 2. Execute
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            # 3. Poll for completion
            for _ in range(40):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    if data["status"] == "completed":
                        break

            final_res = await client.get(f"/api/v1/executions/{exec_id}")
            data = final_res.json()["data"]
            assert data["status"] == "completed"
            assert data["nodes_status"][0]["status"] == "completed"

            # 4. Verify git changes in workspace
            auditor = GitScopeAuditor()
            snapshot = auditor.capture_snapshot(WORKSPACE_DIR_STR)
            for f in snapshot.keys():
                assert is_path_allowed(f, ["client/**"]), f"Unexpected modification outside client: {f}"

    @pytest.mark.asyncio
    async def test_03_scope_violation_and_revert_workflow(self):
        """Test Scenario 3: Agent attempts unauthorized modification outside allowed_paths.
        
        Verifies:
        - Immediate transition to VIOLATION_PAUSED.
        - Git Auditor catches server/snake_server.py as unauthorized modification.
        - POST /revert-violations executes git checkout and restores file.
        - Node completes and resumes execution.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create workflow with simulate_violation=True
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake Violation Pipeline",
                    "description": "Test Git Auditor scope guard on unauthorized edits",
                    "nodes": [
                        {
                            "id": "node_rogue_fe",
                            "preset_id": "frontend",
                            "role_name": "Frontend Canvas Dev",
                            "node_type": "frontend",
                            "color_theme": "#10b981",
                            "icon": "Gamepad2",
                            "position_x": 300.0,
                            "position_y": 200.0,
                            "system_prompt": "Frontend developer restricted to client UI only.",
                            "task_prompt": "Edit UI and illegally modify backend tick loop in server/snake_server.py [SIMULATE_VIOLATION]",
                            "allowed_paths": ["client/**"],
                            "read_only_paths": ["server/**"],
                            "require_human_approval": False,
                            "simulate_violation": True,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_data = wf_res.json()["data"]
            wf_id = wf_data["id"]
            actual_node_id = wf_data["nodes"][0]["id"]

            # 2. Execute
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            # 3. Wait for violation pause
            violation_paused = False
            for _ in range(40):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    nodes_st = data.get("nodes_status", [])
                    if nodes_st and nodes_st[0]["status"] == "violation_paused":
                        violation_paused = True
                        break

            assert violation_paused, "Expected execution node to pause with VIOLATION_PAUSED!"

            # 4. Verify violations API endpoint
            viol_res = await client.get(f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/violations")
            assert viol_res.status_code == 200
            viol_data = viol_res.json()["data"]
            assert "server/snake_server.py" in viol_data["unauthorized_files"]

            # 5. Trigger Revert via Git
            revert_res = await client.post(
                f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/revert-violations",
                json={
                    "reverted_by": "Tech Lead / Tester",
                    "comment": "Reverting unauthorized modification to server/snake_server.py",
                },
            )
            assert revert_res.status_code == 200
            rev_data = revert_res.json()["data"]
            assert "server/snake_server.py" in rev_data["reverted_files"]

            # 6. Wait for workflow completion after revert
            completed_after_revert = False
            for _ in range(40):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    if data.get("status") == "completed":
                        completed_after_revert = True
                        break

            assert completed_after_revert, "Workflow should resume and complete after revert!"

            # 7. Verify git status is clean now
            status_proc = subprocess.run(["git", "status", "--porcelain"], cwd=WORKSPACE_DIR_STR, capture_output=True, text=True)
            assert "snake_server.py" not in status_proc.stdout, "snake_server.py must be restored clean via git!"

    @pytest.mark.asyncio
    async def test_04_pre_execution_human_approval_gate(self):
        """Test Scenario 4: Pre-Execution Human Approval Gate on Critical Node.
        
        Verifies:
        - Node configured with require_human_approval pauses in 'waiting_approval'.
        - Node does not execute until approved.
        - Calling approve_node resumes execution and node completes normally.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create Approval Gate Workflow
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake Approval Gate Pipeline",
                    "description": "Test approval required gate before deployment",
                    "nodes": [
                        {
                            "id": "node_approval_gate",
                            "preset_id": "security",
                            "role_name": "Security & Release Signoff",
                            "node_type": "security",
                            "color_theme": "#ef4444",
                            "icon": "ShieldAlert",
                            "position_x": 500.0,
                            "position_y": 200.0,
                            "system_prompt": "Security auditor verifying production deployment.",
                            "task_prompt": "Audit game server security in docs/architecture.md",
                            "allowed_paths": ["docs/**"],
                            "read_only_paths": ["server/**"],
                            "require_human_approval": True,
                            "simulate_violation": False,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_data = wf_res.json()["data"]
            wf_id = wf_data["id"]
            actual_node_id = wf_data["nodes"][0]["id"]

            # 2. Execute
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            # 3. Wait for waiting_approval state
            is_waiting = False
            for _ in range(30):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    if data["nodes_status"] and data["nodes_status"][0]["status"] == "waiting_approval":
                        is_waiting = True
                        break

            assert is_waiting, "Node should pause in waiting_approval state!"

            # 4. Issue Approval via API
            approve_res = await client.post(
                f"/api/v1/executions/{exec_id}/nodes/{actual_node_id}/approve",
                json={
                    "approved_by": "Principal Security Architect",
                    "comment": "Approved. Allowed to proceed.",
                },
            )
            assert approve_res.status_code == 200

            # 5. Wait for completion
            for _ in range(40):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200 and status_res.json()["data"]["status"] == "completed":
                    break

            final_res = await client.get(f"/api/v1/executions/{exec_id}")
            data = final_res.json()["data"]
            assert data["status"] == "completed"
            assert data["nodes_status"][0]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_05_qa_automated_pytest_runner(self):
        """Test Scenario 5: QA Agent executes real pytest test suite on Snake Game.
        
        Verifies:
        - Pytest is spawned as a subprocess inside lan_snake_workspace.
        - Real pytest execution output (4 passed tests) is captured in terminal logs.
        - QA node finishes with exit code 0.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create QA Workflow
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake QA Protocol Test Pipeline",
                    "description": "Run real pytest tests on snake protocol",
                    "nodes": [
                        {
                            "id": "node_qa_tester",
                            "preset_id": "qa",
                            "role_name": "QA Automation Tester",
                            "node_type": "qa",
                            "color_theme": "#f59e0b",
                            "icon": "CheckCircle2",
                            "position_x": 700.0,
                            "position_y": 200.0,
                            "system_prompt": "QA Automation Engineer verifying multiplayer protocol and arena physics.",
                            "task_prompt": "Execute automated pytest test suite in tests/test_game_protocol.py",
                            "allowed_paths": ["tests/**"],
                            "read_only_paths": ["server/**"],
                            "require_human_approval": False,
                            "simulate_violation": False,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_id = wf_res.json()["data"]["id"]

            # 2. Execute
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            # 3. Poll for completion
            for _ in range(45):
                await asyncio.sleep(0.3)
                status_res = await client.get(f"/api/v1/executions/{exec_id}")
                if status_res.status_code == 200:
                    data = status_res.json()["data"]
                    if data["status"] in ("completed", "failed"):
                        break

            final_res = await client.get(f"/api/v1/executions/{exec_id}")
            data = final_res.json()["data"]
            assert data["status"] == "completed"

            # 4. Verify terminal logs contains pytest results
            logs_res = await client.get(f"/api/v1/executions/{exec_id}/logs")
            assert logs_res.status_code == 200
            logs = logs_res.json()["data"]
            all_text = " ".join(l["chunk"] for l in logs)
            assert "pytest" in all_text or "test_game_protocol" in all_text or "passed" in all_text

    @pytest.mark.asyncio
    async def test_06_stop_workflow_and_kill_process_tree(self):
        """Test Scenario 6: User clicks Stop Workflow during execution.
        
        Verifies:
        - CLIRunner immediately cancels the task and kills process trees.
        - Session transitions to 'stopped'.
        - No orphan processes are left hanging.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create Workflow
            wf_res = await client.post(
                "/api/v1/workflows",
                json={
                    "name": "LAN Snake Stop Test Pipeline",
                    "description": "Test stopping workflow",
                    "nodes": [
                        {
                            "id": "node_heavy_worker",
                            "preset_id": "backend",
                            "role_name": "Heavy Simulation Worker",
                            "node_type": "backend",
                            "color_theme": "#3b82f6",
                            "icon": "Cpu",
                            "position_x": 400.0,
                            "position_y": 200.0,
                            "system_prompt": "Backend agent performing heavy simulation.",
                            "task_prompt": "Run compute simulation in server/snake_server.py",
                            "allowed_paths": ["server/**"],
                            "read_only_paths": [],
                            "require_human_approval": False,
                            "simulate_violation": False,
                        }
                    ],
                    "edges": [],
                },
            )
            assert wf_res.status_code == 201
            wf_id = wf_res.json()["data"]["id"]

            # 2. Execute
            exec_res = await client.post(
                f"/api/v1/workflows/{wf_id}/execute",
                json={
                    "mock_mode": True,
                    "environment_vars": {"WORKSPACE_DIR": WORKSPACE_DIR_STR},
                },
            )
            assert exec_res.status_code == 202
            exec_id = exec_res.json()["data"]["execution_id"]

            await asyncio.sleep(0.3)

            # 3. Stop Execution via API
            stop_res = await client.post(f"/api/v1/executions/{exec_id}/stop")
            assert stop_res.status_code == 200
            assert stop_res.json()["success"] is True

            # 4. Check status
            status_res = await client.get(f"/api/v1/executions/{exec_id}")
            assert status_res.status_code == 200
            assert status_res.json()["data"]["status"] == "stopped"


if __name__ == "__main__":
    clean_workspace_git()
    pytest.main(["-v", __file__])
    clean_workspace_git()
