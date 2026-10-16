"""Main FastAPI Application for Gemini Workflow Studio (Enterprise Multi-Agent Edition).

Exposes REST APIs and WebSocket endpoints adhering to api_spec.md,
providing workflow CRUD, template instantiation, DAG execution management,
Git Diff scope violation auditing, and real-time streaming.
"""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from backend.database import db_session, get_utc_now, init_database
    from backend.lock_manager import lock_manager
    from backend.orchestrator import orchestrator, ws_hub
    from backend.presets import (
        ENTERPRISE_AGENT_PRESETS,
        PRESET_MAP,
        TEMPLATE_MAP,
        WORKFLOW_TEMPLATES,
        seed_presets_and_templates,
    )
except ImportError:
    from database import db_session, get_utc_now, init_database
    from lock_manager import lock_manager
    from orchestrator import orchestrator, ws_hub
    from presets import (
        ENTERPRISE_AGENT_PRESETS,
        PRESET_MAP,
        TEMPLATE_MAP,
        WORKFLOW_TEMPLATES,
        seed_presets_and_templates,
    )

# ============================================================================
# Pydantic Schemas / DTOs
# ============================================================================


class AgentNodeDTO(BaseModel):
    id: str
    preset_id: Optional[str] = None
    role_name: str
    node_type: str = "agent"
    icon: str = "Bot"
    color_theme: str = "#3b82f6"
    position_x: float = 0.0
    position_y: float = 0.0
    system_prompt: str = ""
    task_prompt: str = ""
    allowed_paths: List[str] = Field(default_factory=list)
    read_only_paths: List[str] = Field(default_factory=list)
    require_human_approval: bool = False
    simulate_violation: bool = False


class WorkflowEdgeDTO(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    condition: str = "success"


class CreateWorkflowDTO(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[AgentNodeDTO] = Field(default_factory=list)
    edges: List[WorkflowEdgeDTO] = Field(default_factory=list)


class CreateFromTemplateDTO(BaseModel):
    name: str
    description: Optional[str] = None


class UpdateWorkflowDTO(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[AgentNodeDTO]] = None
    edges: Optional[List[WorkflowEdgeDTO]] = None


class ExecuteWorkflowDTO(BaseModel):
    mock_mode: bool = True
    environment_vars: Dict[str, str] = Field(default_factory=dict)


class RevertViolationsDTO(BaseModel):
    reverted_by: str
    comment: Optional[str] = None


class ApproveViolationsDTO(BaseModel):
    approved_by: str
    reason: str


class ApproveNodeDTO(BaseModel):
    approved_by: str
    comment: Optional[str] = None


class RejectNodeDTO(BaseModel):
    rejected_by: str
    reason: str


class WorkspaceValidateDTO(BaseModel):
    workspace_dir: str


# ============================================================================
# Application Setup & Lifespan
# ============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    init_database()
    # Seed 7 Enterprise Presets & 3 Workflow Templates
    seed_presets_and_templates()
    yield


app = FastAPI(
    title="Gemini Workflow Studio API",
    version="2.0.0",
    description="Enterprise Multi-Agent Orchestrator and Automated Git Diff Auditor",
    lifespan=lifespan,
)

# Enable CORS for frontend Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler for consistent error envelopes
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": "HTTP_ERROR",
                "message": exc.detail,
                "details": None,
            },
        },
    )


# ============================================================================
# 1. Enterprise Presets & Templates Endpoints
# ============================================================================


@app.get("/api/v1/presets", tags=["Presets"])
def get_presets():
    """Retrieve the 7 enterprise agent presets."""
    return {"success": True, "data": ENTERPRISE_AGENT_PRESETS}


@app.get("/api/v1/templates", tags=["Templates"])
@app.get("/api/templates", tags=["Templates"])
def get_templates():
    """Retrieve the 3 built-in workflow templates with full layout data."""
    return {"success": True, "data": WORKFLOW_TEMPLATES}


@app.get("/api/v1/templates/{template_id}", tags=["Templates"])
@app.get("/api/templates/{template_id}", tags=["Templates"])
def get_template_by_id(template_id: str):
    """Retrieve a single built-in workflow template with layout data."""
    template = TEMPLATE_MAP.get(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id '{template_id}' not found."
        )
    return {"success": True, "data": template}


@app.post("/api/v1/workflows/from-template/{template_id}", status_code=status.HTTP_201_CREATED, tags=["Templates"])
def create_workflow_from_template(template_id: str, payload: CreateFromTemplateDTO):
    """Instantiate a new workflow from a built-in template (1-click generation)."""
    template = TEMPLATE_MAP.get(template_id)
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with id '{template_id}' not found."
        )

    workflow_id = f"wf_{uuid.uuid4().hex[:12]}"
    now_iso = get_utc_now()
    layout = template["layout_data"]

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO workflows (id, name, description, template_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                workflow_id,
                payload.name,
                payload.description or template["description"],
                template_id,
                now_iso,
                now_iso,
            )
        )

        # Insert template nodes
        inserted_nodes = []
        for n in layout.get("nodes", []):
            node_id = f"{workflow_id}_{n['id']}"
            cursor.execute(
                """
                INSERT INTO nodes (
                    id, workflow_id, preset_id, role_name, node_type,
                    color_theme, icon, position_x, position_y,
                    system_prompt, task_prompt, allowed_paths, read_only_paths,
                    require_human_approval
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    node_id,
                    workflow_id,
                    n.get("preset_id"),
                    n.get("role_name", "Agent"),
                    n.get("node_type", "agent"),
                    n.get("color_theme", "#3b82f6"),
                    n.get("icon", "Bot"),
                    n.get("position_x", 0.0),
                    n.get("position_y", 0.0),
                    n.get("system_prompt", ""),
                    n.get("task_prompt", ""),
                    json.dumps(n.get("allowed_paths", [])),
                    json.dumps(n.get("read_only_paths", [])),
                    1 if n.get("require_human_approval") else 0,
                )
            )
            inserted_nodes.append({**n, "id": node_id})

        # Insert template edges
        inserted_edges = []
        for e in layout.get("edges", []):
            edge_id = f"e_{uuid.uuid4().hex[:8]}"
            src_id = f"{workflow_id}_{e['source_node_id']}"
            tgt_id = f"{workflow_id}_{e['target_node_id']}"
            cursor.execute(
                """
                INSERT INTO edges (id, workflow_id, source_node_id, target_node_id, condition)
                VALUES (?, ?, ?, ?, ?)
                """,
                (edge_id, workflow_id, src_id, tgt_id, e.get("condition", "success"))
            )
            inserted_edges.append({
                "id": edge_id,
                "source_node_id": src_id,
                "target_node_id": tgt_id,
                "condition": e.get("condition", "success"),
            })

    return {
        "success": True,
        "data": {
            "id": workflow_id,
            "name": payload.name,
            "description": payload.description or template["description"],
            "template_id": template_id,
            "created_at": now_iso,
            "updated_at": now_iso,
            "nodes": inserted_nodes,
            "edges": inserted_edges,
        },
        "message": f"Workflow instantiated from template '{template['name']}' successfully."
    }


# ============================================================================
# 2. Workflow Management (CRUD)
# ============================================================================


@app.get("/api/v1/workflows", tags=["Workflows"])
def list_workflows():
    """List summary of all existing workflows."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflows ORDER BY created_at DESC")
        rows = cursor.fetchall()

        result = []
        for r in rows:
            cursor.execute("SELECT COUNT(*) as cnt FROM nodes WHERE workflow_id = ?", (r["id"],))
            nodes_count = cursor.fetchone()["cnt"]
            cursor.execute("SELECT COUNT(*) as cnt FROM edges WHERE workflow_id = ?", (r["id"],))
            edges_count = cursor.fetchone()["cnt"]

            result.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "template_id": r["template_id"],
                "nodes_count": nodes_count,
                "edges_count": edges_count,
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            })

    return {"success": True, "data": result}


@app.post("/api/v1/workflows", status_code=status.HTTP_201_CREATED, tags=["Workflows"])
def create_workflow(payload: CreateWorkflowDTO):
    """Create a new custom workflow."""
    workflow_id = f"wf_{uuid.uuid4().hex[:12]}"
    now_iso = get_utc_now()

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO workflows (id, name, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (workflow_id, payload.name, payload.description, now_iso, now_iso)
        )

        node_id_map = {}
        for n in payload.nodes:
            target_id = n.id
            cursor.execute("SELECT workflow_id FROM nodes WHERE id = ?", (target_id,))
            existing = cursor.fetchone()
            if existing and existing["workflow_id"] != workflow_id:
                target_id = f"{workflow_id}_{n.id}"
            node_id_map[n.id] = target_id

            cursor.execute(
                """
                INSERT INTO nodes (
                    id, workflow_id, preset_id, role_name, node_type,
                    color_theme, icon, position_x, position_y,
                    system_prompt, task_prompt, allowed_paths, read_only_paths,
                    require_human_approval
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    target_id,
                    workflow_id,
                    n.preset_id,
                    n.role_name,
                    n.node_type,
                    n.color_theme,
                    n.icon,
                    n.position_x,
                    n.position_y,
                    n.system_prompt,
                    n.task_prompt,
                    json.dumps(n.allowed_paths),
                    json.dumps(n.read_only_paths),
                    1 if n.require_human_approval else 0,
                )
            )

        for e in payload.edges:
            src = node_id_map.get(e.source_node_id, e.source_node_id)
            tgt = node_id_map.get(e.target_node_id, e.target_node_id)
            edge_id = e.id
            cursor.execute("SELECT workflow_id FROM edges WHERE id = ?", (edge_id,))
            if cursor.fetchone():
                edge_id = f"{workflow_id}_{e.id}"

            cursor.execute(
                """
                INSERT INTO edges (id, workflow_id, source_node_id, target_node_id, condition)
                VALUES (?, ?, ?, ?, ?)
                """,
                (edge_id, workflow_id, src, tgt, e.condition)
            )

    return {
        "success": True,
        "data": {
            "id": workflow_id,
            "name": payload.name,
            "description": payload.description,
            "created_at": now_iso,
            "updated_at": now_iso,
            "nodes": [{**n.model_dump(), "id": node_id_map[n.id]} for n in payload.nodes],
            "edges": [
                {
                    **e.model_dump(),
                    "source_node_id": node_id_map.get(e.source_node_id, e.source_node_id),
                    "target_node_id": node_id_map.get(e.target_node_id, e.target_node_id),
                }
                for e in payload.edges
            ],
        },
        "message": "Workflow created successfully."
    }


@app.get("/api/v1/workflows/{workflow_id}", tags=["Workflows"])
def get_workflow(workflow_id: str):
    """Get full details of a specific workflow, including nodes and edges."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        wf = cursor.fetchone()
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

        cursor.execute("SELECT * FROM nodes WHERE workflow_id = ?", (workflow_id,))
        node_rows = cursor.fetchall()
        nodes = [
            {
                "id": nr["id"],
                "preset_id": nr["preset_id"],
                "role_name": nr["role_name"],
                "node_type": nr["node_type"],
                "color_theme": nr["color_theme"],
                "icon": nr["icon"],
                "position_x": nr["position_x"],
                "position_y": nr["position_y"],
                "system_prompt": nr["system_prompt"],
                "task_prompt": nr["task_prompt"],
                "allowed_paths": json.loads(nr["allowed_paths"] or "[]"),
                "read_only_paths": json.loads(nr["read_only_paths"] or "[]"),
                "require_human_approval": bool(nr["require_human_approval"]),
                "simulate_violation": "[SIMULATE_VIOLATION]" in (nr["task_prompt"] or ""),
            }
            for nr in node_rows
        ]

        cursor.execute("SELECT * FROM edges WHERE workflow_id = ?", (workflow_id,))
        edge_rows = cursor.fetchall()
        edges = [
            {
                "id": er["id"],
                "source_node_id": er["source_node_id"],
                "target_node_id": er["target_node_id"],
                "condition": er["condition"],
            }
            for er in edge_rows
        ]

    return {
        "success": True,
        "data": {
            "id": wf["id"],
            "name": wf["name"],
            "description": wf["description"],
            "template_id": wf["template_id"],
            "created_at": wf["created_at"],
            "updated_at": wf["updated_at"],
            "nodes": nodes,
            "edges": edges,
        }
    }


@app.put("/api/v1/workflows/{workflow_id}", tags=["Workflows"])
def update_workflow(workflow_id: str, payload: UpdateWorkflowDTO):
    """Update workflow name, description, canvas layout coordinates, nodes, and edges."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workflows WHERE id = ?", (workflow_id,))
        wf = cursor.fetchone()
        if not wf:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

        now_iso = get_utc_now()
        name = payload.name if payload.name is not None else wf["name"]
        description = payload.description if payload.description is not None else wf["description"]

        cursor.execute(
            "UPDATE workflows SET name = ?, description = ?, updated_at = ? WHERE id = ?",
            (name, description, now_iso, workflow_id)
        )

        if payload.nodes is not None:
            cursor.execute("DELETE FROM nodes WHERE workflow_id = ?", (workflow_id,))
            for n in payload.nodes:
                cursor.execute(
                    """
                    INSERT INTO nodes (
                        id, workflow_id, preset_id, role_name, node_type,
                        color_theme, icon, position_x, position_y,
                        system_prompt, task_prompt, allowed_paths, read_only_paths,
                        require_human_approval
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        n.id,
                        workflow_id,
                        n.preset_id,
                        n.role_name,
                        n.node_type,
                        n.color_theme,
                        n.icon,
                        n.position_x,
                        n.position_y,
                        n.system_prompt,
                        n.task_prompt,
                        json.dumps(n.allowed_paths),
                        json.dumps(n.read_only_paths),
                        1 if n.require_human_approval else 0,
                    )
                )

        if payload.edges is not None:
            cursor.execute("DELETE FROM edges WHERE workflow_id = ?", (workflow_id,))
            for e in payload.edges:
                cursor.execute(
                    """
                    INSERT INTO edges (id, workflow_id, source_node_id, target_node_id, condition)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (e.id, workflow_id, e.source_node_id, e.target_node_id, e.condition)
                )

    return get_workflow(workflow_id)


@app.delete("/api/v1/workflows/{workflow_id}", tags=["Workflows"])
def delete_workflow(workflow_id: str):
    """Delete a workflow and its associated nodes and edges."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM workflows WHERE id = ?", (workflow_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")
        cursor.execute("DELETE FROM workflows WHERE id = ?", (workflow_id,))

    return {"success": True, "message": "Workflow deleted successfully"}


# ============================================================================
# 3. Execution Control & State Endpoints
# ============================================================================


@app.post("/api/v1/workflows/{workflow_id}/execute", status_code=status.HTTP_202_ACCEPTED, tags=["Executions"])
async def execute_workflow(workflow_id: str, payload: ExecuteWorkflowDTO):
    """Trigger asynchronous execution of a workflow DAG."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM workflows WHERE id = ?", (workflow_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    # Validate target_project_dir has .git and initial commit
    workspace_dir = (payload.environment_vars or {}).get("WORKSPACE_DIR")
    if not workspace_dir:
        workspace_dir = str(Path(__file__).resolve().parent.parent)

    is_valid_git, git_err_msg = orchestrator.auditor.validate_git_repository(workspace_dir)
    if not is_valid_git:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=git_err_msg
        )

    execution_id = f"exec_{uuid.uuid4().hex}"
    now_iso = get_utc_now()

    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO executions (id, workflow_id, status, mock_mode, start_time, triggered_by)
            VALUES (?, ?, 'running', ?, ?, 'user')
            """,
            (execution_id, workflow_id, 1 if payload.mock_mode else 0, now_iso)
        )

    # Launch DAG orchestrator in background task
    await orchestrator.start_execution(
        execution_id=execution_id,
        workflow_id=workflow_id,
        mock_mode=payload.mock_mode,
        environment_vars=payload.environment_vars,
    )

    return {
        "success": True,
        "data": {
            "execution_id": execution_id,
            "workflow_id": workflow_id,
            "status": "running",
            "mock_mode": payload.mock_mode,
        },
        "message": "Execution started."
    }


@app.post("/api/v1/workspace/validate", tags=["Workspace"])
def validate_workspace(payload: WorkspaceValidateDTO):
    """Validate whether target directory exists, has git initialized, and has an initial commit."""
    is_valid, err_msg = orchestrator.auditor.validate_git_repository(payload.workspace_dir)
    return {
        "success": True,
        "data": {
            "workspace_dir": payload.workspace_dir,
            "is_valid": is_valid,
            "error_message": err_msg,
        }
    }


@app.get("/api/v1/executions/{execution_id}", tags=["Executions"])
def get_execution_status(execution_id: str):
    """Get current status of an execution, including node states, git violations, and active locks."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM executions WHERE id = ?", (execution_id,))
        exec_row = cursor.fetchone()
        if not exec_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution session not found.")

        cursor.execute("SELECT * FROM execution_nodes WHERE execution_id = ?", (execution_id,))
        node_rows = cursor.fetchall()
        nodes_status = []
        for nr in node_rows:
            v_data = json.loads(nr["violation_data"]) if nr["violation_data"] else None
            nodes_status.append({
                "node_id": nr["node_id"],
                "status": nr["status"],
                "error_message": nr["error_message"],
                "violation_data": v_data,
                "violation_action_at": nr["violation_action_at"],
                "violation_action_by": nr["violation_action_by"],
                "start_time": nr["start_time"],
                "end_time": nr["end_time"],
                "approved_at": nr["approved_at"],
                "approved_by": nr["approved_by"],
            })

    active_locks = lock_manager.get_active_locks(execution_id)

    return {
        "success": True,
        "data": {
            "id": exec_row["id"],
            "workflow_id": exec_row["workflow_id"],
            "status": exec_row["status"],
            "mock_mode": bool(exec_row["mock_mode"]),
            "start_time": exec_row["start_time"],
            "end_time": exec_row["end_time"],
            "nodes_status": nodes_status,
            "active_locks": active_locks,
        }
    }


@app.post("/api/v1/executions/{execution_id}/stop", tags=["Executions"])
async def stop_execution(execution_id: str):
    """Emergency terminate an ongoing execution session and release locks."""
    success = await orchestrator.stop_execution(execution_id)
    return {"success": True, "message": "Subprocesses terminated and locks cleared."}


# ============================================================================
# 4. Git Diff Auditor Violation Handling (Revert & Approve)
# ============================================================================


@app.post("/api/v1/executions/{execution_id}/nodes/{node_id}/revert-violations", tags=["Git Auditor"])
def revert_violations(execution_id: str, node_id: str, payload: RevertViolationsDTO):
    """Revert unauthorized file modifications made by an agent and resume DAG execution."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT node_id, violation_data, status FROM execution_nodes
            WHERE execution_id = ? AND (node_id = ? OR node_id LIKE '%_' || ?)
            """,
            (execution_id, node_id, node_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution node not found.")

        real_node_id = row["node_id"]
        v_data = json.loads(row["violation_data"]) if row["violation_data"] else {}
        unauthorized_files = v_data.get("unauthorized_files", [])

    # Wake up orchestrator to revert files and resume DAG
    resolved = orchestrator.resolve_violation(
        execution_id=execution_id,
        node_id=real_node_id,
        action="reverted",
        actor=payload.reverted_by,
        note=payload.comment or "",
    )

    return {
        "success": True,
        "data": {
            "node_id": real_node_id,
            "status": "completed",
            "reverted_files": unauthorized_files,
            "action": "reverted",
        },
        "message": "Unauthorized files successfully reverted. Workflow resumed."
    }


@app.post("/api/v1/executions/{execution_id}/nodes/{node_id}/approve-violations", tags=["Git Auditor"])
def approve_violations(execution_id: str, node_id: str, payload: ApproveViolationsDTO):
    """Approve scope violations, accept modified files, and resume downstream DAG branches."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT node_id, violation_data, status FROM execution_nodes
            WHERE execution_id = ? AND (node_id = ? OR node_id LIKE '%_' || ?)
            """,
            (execution_id, node_id, node_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution node not found.")

        real_node_id = row["node_id"]
        v_data = json.loads(row["violation_data"]) if row["violation_data"] else {}
        accepted_files = v_data.get("unauthorized_files", [])

    # Wake up orchestrator to accept files and resume DAG
    resolved = orchestrator.resolve_violation(
        execution_id=execution_id,
        node_id=real_node_id,
        action="approved",
        actor=payload.approved_by,
        note=payload.reason,
    )

    return {
        "success": True,
        "data": {
            "node_id": real_node_id,
            "status": "completed",
            "accepted_files": accepted_files,
            "action": "approved",
        },
        "message": "Scope expansion approved by user. Workflow resumed."
    }


@app.get("/api/v1/executions/{execution_id}/nodes/{node_id}/violations", tags=["Git Auditor"])
def get_node_violations(execution_id: str, node_id: str):
    """View full git diff violation data for a paused node."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT node_id, violation_data, status FROM execution_nodes
            WHERE execution_id = ? AND (node_id = ? OR node_id LIKE '%_' || ?)
            """,
            (execution_id, node_id, node_id)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution node not found.")

        v_data = json.loads(row["violation_data"]) if row["violation_data"] else None

    return {
        "success": True,
        "data": v_data or {"unauthorized_files": [], "diffs": []}
    }


# ============================================================================
# 5. Pre-Execution Human Approval Gate
# ============================================================================


@app.post("/api/v1/executions/{execution_id}/nodes/{node_id}/approve", tags=["Approval"])
def approve_node(execution_id: str, node_id: str, payload: ApproveNodeDTO):
    """Approve a node paused in waiting_approval state so it may execute."""
    resolved = orchestrator.resolve_approval(
        execution_id=execution_id,
        node_id=node_id,
        approved=True,
        actor=payload.approved_by,
        note=payload.comment or "",
    )
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Node is not in waiting_approval state."
        )
    return {"success": True, "message": "Node approved successfully."}


@app.post("/api/v1/executions/{execution_id}/nodes/{node_id}/reject", tags=["Approval"])
def reject_node(execution_id: str, node_id: str, payload: RejectNodeDTO):
    """Reject a node waiting for approval, terminating that branch."""
    resolved = orchestrator.resolve_approval(
        execution_id=execution_id,
        node_id=node_id,
        approved=False,
        actor=payload.rejected_by,
        note=payload.reason,
    )
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Node is not in waiting_approval state."
        )
    return {"success": True, "message": "Node rejected."}


# ============================================================================
# 6. Terminal Execution Logs Endpoint
# ============================================================================


@app.get("/api/v1/executions/{execution_id}/logs", tags=["Logs"])
def get_execution_logs(
    execution_id: str,
    node_id: Optional[str] = Query(None, description="Optional filter by node ID")
):
    """Retrieve captured terminal output logs for an execution."""
    with db_session() as conn:
        cursor = conn.cursor()
        if node_id:
            cursor.execute(
                """
                SELECT * FROM execution_logs
                WHERE execution_id = ? AND node_id = ?
                ORDER BY seq_order ASC
                """,
                (execution_id, node_id)
            )
        else:
            cursor.execute(
                """
                SELECT * FROM execution_logs
                WHERE execution_id = ?
                ORDER BY id ASC
                """,
                (execution_id,)
            )
        rows = cursor.fetchall()

        logs = [
            {
                "id": r["id"],
                "execution_id": r["execution_id"],
                "node_id": r["node_id"],
                "stream_type": r["stream_type"],
                "chunk": r["chunk"],
                "seq_order": r["seq_order"],
                "timestamp": r["timestamp"],
            }
            for r in rows
        ]

    return {"success": True, "data": logs}


# ============================================================================
# 7. WebSocket Streaming Endpoint
# ============================================================================


@app.websocket("/ws/executions/{execution_id}")
async def websocket_execution_endpoint(websocket: WebSocket, execution_id: str):
    """Realtime WebSocket endpoint streaming terminal logs, status changes, and violation alerts."""
    await ws_hub.connect(execution_id, websocket)

    # Send connection acknowledgment
    await websocket.send_json({
        "type": "connection_ack",
        "execution_id": execution_id,
        "timestamp": get_utc_now(),
        "payload": {
            "connected": True,
            "message": "WebSocket connection established successfully."
        }
    })

    # Replay any existing node statuses or violations that occurred before client connected
    try:
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM execution_nodes WHERE execution_id = ?", (execution_id,))
            for nr in cursor.fetchall():
                if nr["status"] == "violation_paused" and nr["violation_data"]:
                    v_data = json.loads(nr["violation_data"])
                    cursor.execute("SELECT role_name, allowed_paths FROM nodes WHERE id = ?", (nr["node_id"],))
                    n_info = cursor.fetchone()
                    role_name = n_info["role_name"] if n_info else "Agent"
                    allowed_paths = json.loads(n_info["allowed_paths"]) if n_info and n_info["allowed_paths"] else []
                    await websocket.send_json({
                        "type": "scope_violation_alert",
                        "execution_id": execution_id,
                        "timestamp": get_utc_now(),
                        "payload": {
                            "node_id": nr["node_id"],
                            "role_name": role_name,
                            "allowed_paths": allowed_paths,
                            "unauthorized_files": v_data.get("unauthorized_files", []),
                            "diffs": v_data.get("diffs", []),
                            "detected_at": v_data.get("detected_at", get_utc_now()),
                        }
                    })
    except Exception as e:
        logger.warning(f"Failed to replay state on WS connect: {e}")

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Handle ping/pong heartbeat
                if msg.get("type") == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "execution_id": execution_id,
                        "timestamp": get_utc_now(),
                        "payload": {}
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await ws_hub.disconnect(execution_id, websocket)
    except Exception:
        await ws_hub.disconnect(execution_id, websocket)


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": get_utc_now()}
