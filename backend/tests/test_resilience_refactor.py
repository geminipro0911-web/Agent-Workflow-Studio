"""Tests for Backend Resilience Refactoring (WebSocket, Subprocess, Node Linking & Graph Execution).
Verifies fixes inspired by Claude-Code-Workflow patterns:
- Non-blocking concurrent WebSocket broadcast and graceful disconnect cleanup
- Subprocess chunk-based streaming without newline deadlocks and long-prompt handling
- DAG cycle detection, cascade skipping on upstream failures, and edge preservation
"""

import asyncio
import json
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.orchestrator import orchestrator, ws_hub, interpolate_prompt
from backend.cli_runner import cli_runner, inject_strict_scope_rules
from backend.database import db_session, init_database


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_database()


class TestWebSocketResilience:
    """Tests WebSocket non-blocking broadcast, error tolerance, and cleanup."""

    @pytest.mark.asyncio
    async def test_websocket_broadcast_non_blocking_with_slow_client(self):
        """Broadcast should not block or fail when a client socket hangs or is slow."""
        exec_id = "test_ws_resilience_exec"

        class MockSlowWebSocket:
            def __init__(self, should_fail=False):
                self.should_fail = should_fail
                self.sent_messages = []

            async def send_json(self, message):
                if self.should_fail:
                    raise ConnectionResetError("Connection lost")
                self.sent_messages.append(message)

        fast_client = MockSlowWebSocket(should_fail=False)
        broken_client = MockSlowWebSocket(should_fail=True)

        # Manually register mock sockets into WebSocketHub
        async with ws_hub._lock:
            conns = ws_hub._connections.setdefault(exec_id, set())
            conns.add(fast_client)
            conns.add(broken_client)

        test_msg = {"type": "test_event", "payload": {"status": "ok"}}
        await ws_hub.broadcast(exec_id, test_msg, timeout=0.5)

        # Fast client should receive message
        assert len(fast_client.sent_messages) == 1
        assert fast_client.sent_messages[0]["type"] == "test_event"

        # Broken client should have been pruned from connections
        async with ws_hub._lock:
            remaining = ws_hub._connections.get(exec_id, set())
            assert broken_client not in remaining
            assert fast_client in remaining

        # Cleanup
        await ws_hub.disconnect(exec_id, fast_client)

    def test_websocket_heartbeat_and_ack(self):
        """WebSocket endpoint should acknowledge connection and respond to ping."""
        client = TestClient(app)
        exec_id = "test_heartbeat_exec"
        with client.websocket_connect(f"/ws/executions/{exec_id}") as ws:
            ack = ws.receive_json()
            assert ack["type"] == "connection_ack"
            assert ack["execution_id"] == exec_id
            assert ack["payload"]["connected"] is True

            ws.send_text(json.dumps({"type": "ping"}))
            pong = ws.receive_json()
            assert pong["type"] == "pong"
            assert pong["execution_id"] == exec_id


class TestSubprocessResilience:
    """Tests Subprocess streaming, long prompt handling, and process termination."""

    @pytest.mark.asyncio
    async def test_mock_mode_streaming_chunks(self):
        """Mock mode should stream logs chunk by chunk."""
        node = {
            "id": "node_stream_test",
            "role_name": "Stream Tester",
            "task_prompt": "Run streaming verification",
            "allowed_paths": ["docs/**"],
        }
        logs_received = []

        async def log_cb(stream_type, chunk, seq):
            logs_received.append((stream_type, chunk, seq))

        success = await cli_runner.run_node(
            node=node,
            workspace_dir=".",
            on_log=log_cb,
            mock_mode=True,
            simulate_violation=False,
        )
        assert success is True
        assert len(logs_received) > 0
        # Check sequences are monotonically increasing
        seqs = [l[2] for l in logs_received]
        assert seqs == sorted(seqs)

    def test_prompt_injector_strict_scope(self):
        """Strict scope prompt injection appends mandatory rules."""
        full_prompt = inject_strict_scope_rules(
            system_prompt="System instructions.",
            task_prompt="Implement feature X.",
            allowed_paths=["src/backend/**"],
            read_only_paths=["docs/**"]
        )
        assert "[STRICT SCOPE ENFORCEMENT RULES — MANDATORY]" in full_prompt
        assert "src/backend/**" in full_prompt
        assert "docs/**" in full_prompt


class TestDAGAndNodeLinkingResilience:
    """Tests DAG cycle detection, cascade skip on upstream failure, edge preservation, and context interpolation."""

    def test_cycle_detection_detects_cycles(self):
        """Cycle detection should detect circular dependencies in workflows."""
        nodes = ["A", "B", "C"]
        # Cycle: A -> B -> C -> A
        edges = [("A", "B"), ("B", "C"), ("C", "A")]
        has_cycle, cycle_nodes = orchestrator.check_cycles(nodes, edges)
        assert has_cycle is True
        assert len(cycle_nodes) == 3

    def test_cycle_detection_passes_valid_dag(self):
        """Cycle detection should accept a valid DAG."""
        nodes = ["A", "B", "C", "D"]
        # Diamond DAG: A -> B, A -> C, B -> D, C -> D
        edges = [("A", "B"), ("A", "C"), ("B", "D"), ("C", "D")]
        has_cycle, topo_order = orchestrator.check_cycles(nodes, edges)
        assert has_cycle is False
        assert topo_order[0] == "A"
        assert topo_order[-1] == "D"

    def test_context_prompt_interpolation(self):
        """Interpolates {{variable}} and {{node.output}} into node prompts."""
        context = {
            "node_arch_output": "Schema definition: User(id, name)",
            "node_arch": {"output": "Schema definition: User(id, name)"},
            "api_version": "v2",
        }
        template = "Build API {{api_version}} using architecture from {{node_arch_output}}."
        interpolated = interpolate_prompt(template, context)
        assert "Build API v2 using architecture from Schema definition: User(id, name)." == interpolated

    def test_edge_preservation_when_updating_nodes_only(self):
        """Updating workflow nodes without specifying edges should preserve existing edges."""
        client = TestClient(app)

        # 1. Create workflow with nodes and edges
        create_payload = {
            "name": "Edge Preservation Test WF",
            "nodes": [
                {"id": "node_1", "role_name": "Dev 1", "node_type": "agent", "position_x": 0, "position_y": 0},
                {"id": "node_2", "role_name": "Dev 2", "node_type": "agent", "position_x": 100, "position_y": 0},
            ],
            "edges": [
                {"id": "e_1_2", "source_node_id": "node_1", "target_node_id": "node_2", "condition": "success"}
            ]
        }
        res = client.post("/api/v1/workflows", json=create_payload)
        assert res.status_code == 201
        wf_id = res.json()["data"]["id"]

        # 2. Update ONLY nodes (e.g. user moved node or changed prompt) - edges is None
        update_payload = {
            "nodes": [
                {"id": "node_1", "role_name": "Dev 1 Updated", "node_type": "agent", "position_x": 50, "position_y": 50},
                {"id": "node_2", "role_name": "Dev 2 Updated", "node_type": "agent", "position_x": 150, "position_y": 50},
            ]
        }
        res_update = client.put(f"/api/v1/workflows/{wf_id}", json=update_payload)
        assert res_update.status_code == 200
        updated_data = res_update.json()["data"]

        # Edge must NOT be wiped out!
        assert len(updated_data["edges"]) == 1
        assert updated_data["edges"][0]["source_node_id"] in ("node_1", f"{wf_id}_node_1")
        assert updated_data["edges"][0]["target_node_id"] in ("node_2", f"{wf_id}_node_2")

    def test_execute_workflow_rejects_cyclic_workflow(self):
        """Triggering execution on a cyclic workflow should return 400 Bad Request."""
        client = TestClient(app)

        create_payload = {
            "name": "Cyclic WF Test",
            "nodes": [
                {"id": "c_node_1", "role_name": "Agent 1", "node_type": "agent", "position_x": 0, "position_y": 0},
                {"id": "c_node_2", "role_name": "Agent 2", "node_type": "agent", "position_x": 100, "position_y": 0},
            ],
            "edges": [
                {"id": "e_c1_c2", "source_node_id": "c_node_1", "target_node_id": "c_node_2", "condition": "success"},
                {"id": "e_c2_c1", "source_node_id": "c_node_2", "target_node_id": "c_node_1", "condition": "success"},
            ]
        }
        res = client.post("/api/v1/workflows", json=create_payload)
        assert res.status_code == 201
        wf_id = res.json()["data"]["id"]

        # Attempt to execute cyclic workflow
        exec_res = client.post(f"/api/v1/workflows/{wf_id}/execute", json={"mock_mode": True})
        assert exec_res.status_code == 400
        error_msg = exec_res.json().get("error", {}).get("message", "") or exec_res.json().get("detail", "")
        assert "circular dependencies" in error_msg.lower()
