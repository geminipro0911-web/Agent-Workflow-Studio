"""Enterprise Agent Presets and Standardized Workflow Templates.

Defines the 7 Enterprise Agent Presets:
- Product Manager (BA)
- System Architect
- Database Engineer
- Backend Developer
- Frontend Developer
- QA & Automation Tester
- Security / Code Reviewer

And the 3 Built-in 1-Click Workflow Templates:
- Full-Stack SDLC Pipeline
- Fast Feature Pipeline
- Bug Hotfix Pipeline
"""

from __future__ import annotations

import json
from typing import Any, Dict, List
try:
    from backend.database import db_session
except ImportError:
    from database import db_session

# ============================================================================
# 1. 7 Enterprise Agent Presets
# ============================================================================

ENTERPRISE_AGENT_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "pm",
        "role_name": "Product Manager (BA)",
        "icon": "Briefcase",
        "color_theme": "#f59e0b",
        "default_system_prompt": (
            "You are an expert Enterprise Technical Product Manager & Business Analyst.\n"
            "Your mission is to clarify user requirements, write clear user stories with acceptance criteria (Gherkin format), and define functional scopes.\n"
            "Always organize specifications logically under docs/requirements/ and ensure all non-functional requirements (performance, accessibility, security) are explicitly documented.\n"
            "Do NOT write application code or database migrations."
        ),
        "default_allowed_paths": [
            "docs/requirements/**",
            "docs/specs/**"
        ],
        "default_read_only_paths": [
            "README.md"
        ]
    },
    {
        "id": "architect",
        "role_name": "System Architect",
        "icon": "Compass",
        "color_theme": "#8b5cf6",
        "default_system_prompt": (
            "You are a Principal Software & Systems Architect.\n"
            "Your mission is to design scalable, fault-tolerant system architectures, clean API specifications (OpenAPI/AsyncAPI), and modular component topologies.\n"
            "Document architecture decisions via ADRs (Architecture Decision Records) in docs/architecture/ and define strict interface schemas in api_spec.md.\n"
            "Do NOT modify frontend view code or write application business logic."
        ),
        "default_allowed_paths": [
            "docs/architecture/**",
            "docs/api/**",
            "api_spec.md"
        ],
        "default_read_only_paths": [
            "docs/requirements/**"
        ]
    },
    {
        "id": "database",
        "role_name": "Database Engineer",
        "icon": "Database",
        "color_theme": "#10b981",
        "default_system_prompt": (
            "You are a Senior Database Administrator & Data Modeler.\n"
            "Your mission is to design relational/NoSQL schemas, write clean migration scripts (Alembic/Flyway), optimize indexing strategies, and enforce data integrity constraints.\n"
            "Ensure all tables include audit timestamps (created_at, updated_at) and foreign key relationships are strictly normalized.\n"
            "Only write within backend/migrations/ and backend/app/models/."
        ),
        "default_allowed_paths": [
            "backend/migrations/**",
            "backend/app/models/**",
            "backend/sql/**"
        ],
        "default_read_only_paths": [
            "docs/architecture/**",
            "api_spec.md"
        ]
    },
    {
        "id": "backend",
        "role_name": "Backend Developer",
        "icon": "Server",
        "color_theme": "#3b82f6",
        "default_system_prompt": (
            "You are a Senior Backend Software Engineer specializing in Python FastAPI / Node.js.\n"
            "Your mission is to implement robust REST & WebSocket APIs strictly adhering to api_spec.md.\n"
            "Follow Clean Architecture, implement comprehensive error handling, input validation with Pydantic, and ensure zero SQL injection vulnerabilities.\n"
            "Only write code in backend/app/ and backend/tests/."
        ),
        "default_allowed_paths": [
            "backend/app/**",
            "backend/tests/**"
        ],
        "default_read_only_paths": [
            "docs/api/**",
            "api_spec.md",
            "backend/app/models/**"
        ]
    },
    {
        "id": "frontend",
        "role_name": "Frontend Developer",
        "icon": "Layout",
        "color_theme": "#06b6d4",
        "default_system_prompt": (
            "You are a Staff Frontend Engineer specializing in React, TypeScript, TailwindCSS, and state management.\n"
            "Your mission is to build highly responsive, accessible (WCAG 2.1 AA), and performant web interfaces.\n"
            "Maintain strict TypeScript types matching the backend schema, build reusable atomic UI components, and handle loading/error states gracefully.\n"
            "Only write code in frontend/src/."
        ),
        "default_allowed_paths": [
            "frontend/src/**"
        ],
        "default_read_only_paths": [
            "api_spec.md",
            "docs/api/**"
        ]
    },
    {
        "id": "qa",
        "role_name": "QA & Automation Tester",
        "icon": "CheckSquare",
        "color_theme": "#22c55e",
        "default_system_prompt": (
            "You are a Lead QA Automation & Test Engineer.\n"
            "Your mission is to develop end-to-end (Playwright/Cypress), integration (pytest/jest), and unit test suites that validate system behavior against acceptance criteria.\n"
            "Never modify source code to make tests pass; instead, record detailed defect reports under docs/test_reports/.\n"
            "Only write within tests/, e2e/, and docs/test_reports/."
        ),
        "default_allowed_paths": [
            "tests/**",
            "e2e/**",
            "docs/test_reports/**"
        ],
        "default_read_only_paths": [
            "backend/**",
            "frontend/**",
            "api_spec.md"
        ]
    },
    {
        "id": "security",
        "role_name": "Security / Code Reviewer",
        "icon": "ShieldAlert",
        "color_theme": "#f43f5e",
        "default_system_prompt": (
            "You are a Principal Application Security Engineer (AppSec) and Lead Code Auditor.\n"
            "Your mission is to review all modified files across backend and frontend for OWASP Top 10 vulnerabilities, secret leakage, authorization bypasses, and adherence to clean code standards.\n"
            "Generate comprehensive audit logs in docs/security_audit/ and recommend actionable remediation steps.\n"
            "Do NOT modify application code directly."
        ),
        "default_allowed_paths": [
            "docs/security_audit/**",
            "SECURITY.md"
        ],
        "default_read_only_paths": [
            "backend/**",
            "frontend/**",
            "docs/**"
        ]
    }
]

# Quick lookup map by preset ID
PRESET_MAP: Dict[str, Dict[str, Any]] = {p["id"]: p for p in ENTERPRISE_AGENT_PRESETS}


# ============================================================================
# 2. 3 Built-in Workflow Templates
# ============================================================================

WORKFLOW_TEMPLATES: List[Dict[str, Any]] = [
    {
        "id": "fullstack_sdlc",
        "name": "Full-Stack SDLC Pipeline",
        "description": "Enterprise end-to-end SDLC: PM -> Architect -> Database -> [Backend & Frontend in parallel] -> QA -> Security",
        "nodes_count": 7,
        "edges_count": 7,
        "layout_data": {
            "nodes": [
                {
                    "id": "node_pm",
                    "preset_id": "pm",
                    "role_name": "Product Manager (BA)",
                    "node_type": "pm",
                    "color_theme": "#f59e0b",
                    "icon": "Briefcase",
                    "position_x": 100.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["pm"]["default_system_prompt"],
                    "task_prompt": "Define product requirements, user stories, and acceptance criteria in docs/requirements/.",
                    "allowed_paths": PRESET_MAP["pm"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["pm"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_arch",
                    "preset_id": "architect",
                    "role_name": "System Architect",
                    "node_type": "architect",
                    "color_theme": "#8b5cf6",
                    "icon": "Compass",
                    "position_x": 380.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["architect"]["default_system_prompt"],
                    "task_prompt": "Draft architectural ADRs under docs/architecture/ and specify endpoints in api_spec.md.",
                    "allowed_paths": PRESET_MAP["architect"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["architect"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_db",
                    "preset_id": "database",
                    "role_name": "Database Engineer",
                    "node_type": "database",
                    "color_theme": "#10b981",
                    "icon": "Database",
                    "position_x": 660.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["database"]["default_system_prompt"],
                    "task_prompt": "Design relational schema and write migrations under backend/migrations/.",
                    "allowed_paths": PRESET_MAP["database"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["database"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_be",
                    "preset_id": "backend",
                    "role_name": "Backend Developer",
                    "node_type": "backend",
                    "color_theme": "#3b82f6",
                    "icon": "Server",
                    "position_x": 940.0,
                    "position_y": 100.0,
                    "system_prompt": PRESET_MAP["backend"]["default_system_prompt"],
                    "task_prompt": "Implement FastAPI routers, controllers, and services in backend/app/.",
                    "allowed_paths": PRESET_MAP["backend"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["backend"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_fe",
                    "preset_id": "frontend",
                    "role_name": "Frontend Developer",
                    "node_type": "frontend",
                    "color_theme": "#06b6d4",
                    "icon": "Layout",
                    "position_x": 940.0,
                    "position_y": 300.0,
                    "system_prompt": PRESET_MAP["frontend"]["default_system_prompt"],
                    "task_prompt": "Build React UI components and state management under frontend/src/.",
                    "allowed_paths": PRESET_MAP["frontend"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["frontend"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_qa",
                    "preset_id": "qa",
                    "role_name": "QA & Automation Tester",
                    "node_type": "qa",
                    "color_theme": "#22c55e",
                    "icon": "CheckSquare",
                    "position_x": 1220.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["qa"]["default_system_prompt"],
                    "task_prompt": "Write automated end-to-end tests in tests/ and compile test reports in docs/test_reports/.",
                    "allowed_paths": PRESET_MAP["qa"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["qa"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_sec",
                    "preset_id": "security",
                    "role_name": "Security / Code Reviewer",
                    "node_type": "security",
                    "color_theme": "#f43f5e",
                    "icon": "ShieldAlert",
                    "position_x": 1500.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["security"]["default_system_prompt"],
                    "task_prompt": "Review changes for OWASP Top 10 vulnerabilities and log findings in docs/security_audit/.",
                    "allowed_paths": PRESET_MAP["security"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["security"]["default_read_only_paths"],
                    "require_human_approval": False
                }
            ],
            "edges": [
                {"id": "e_pm_arch", "source_node_id": "node_pm", "target_node_id": "node_arch", "condition": "success"},
                {"id": "e_arch_db", "source_node_id": "node_arch", "target_node_id": "node_db", "condition": "success"},
                {"id": "e_db_be", "source_node_id": "node_db", "target_node_id": "node_be", "condition": "success"},
                {"id": "e_db_fe", "source_node_id": "node_db", "target_node_id": "node_fe", "condition": "success"},
                {"id": "e_be_qa", "source_node_id": "node_be", "target_node_id": "node_qa", "condition": "success"},
                {"id": "e_fe_qa", "source_node_id": "node_fe", "target_node_id": "node_qa", "condition": "success"},
                {"id": "e_qa_sec", "source_node_id": "node_qa", "target_node_id": "node_sec", "condition": "success"}
            ]
        }
    },
    {
        "id": "fast_feature",
        "name": "Fast Feature Pipeline",
        "description": "Rapid parallel development: Architect -> [Backend & Frontend] -> QA Tester",
        "nodes_count": 4,
        "edges_count": 4,
        "layout_data": {
            "nodes": [
                {
                    "id": "node_arch",
                    "preset_id": "architect",
                    "role_name": "System Architect",
                    "node_type": "architect",
                    "color_theme": "#8b5cf6",
                    "icon": "Compass",
                    "position_x": 100.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["architect"]["default_system_prompt"],
                    "task_prompt": "Define feature contract in api_spec.md and docs/architecture/.",
                    "allowed_paths": PRESET_MAP["architect"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["architect"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_be",
                    "preset_id": "backend",
                    "role_name": "Backend Developer",
                    "node_type": "backend",
                    "color_theme": "#3b82f6",
                    "icon": "Server",
                    "position_x": 380.0,
                    "position_y": 100.0,
                    "system_prompt": PRESET_MAP["backend"]["default_system_prompt"],
                    "task_prompt": "Implement feature backend APIs in backend/app/.",
                    "allowed_paths": PRESET_MAP["backend"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["backend"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_fe",
                    "preset_id": "frontend",
                    "role_name": "Frontend Developer",
                    "node_type": "frontend",
                    "color_theme": "#06b6d4",
                    "icon": "Layout",
                    "position_x": 380.0,
                    "position_y": 300.0,
                    "system_prompt": PRESET_MAP["frontend"]["default_system_prompt"],
                    "task_prompt": "Implement feature user interface in frontend/src/.",
                    "allowed_paths": PRESET_MAP["frontend"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["frontend"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_qa",
                    "preset_id": "qa",
                    "role_name": "QA & Automation Tester",
                    "node_type": "qa",
                    "color_theme": "#22c55e",
                    "icon": "CheckSquare",
                    "position_x": 660.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["qa"]["default_system_prompt"],
                    "task_prompt": "Run integration tests across backend and frontend in tests/.",
                    "allowed_paths": PRESET_MAP["qa"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["qa"]["default_read_only_paths"],
                    "require_human_approval": False
                }
            ],
            "edges": [
                {"id": "e_arch_be", "source_node_id": "node_arch", "target_node_id": "node_be", "condition": "success"},
                {"id": "e_arch_fe", "source_node_id": "node_arch", "target_node_id": "node_fe", "condition": "success"},
                {"id": "e_be_qa", "source_node_id": "node_be", "target_node_id": "node_qa", "condition": "success"},
                {"id": "e_fe_qa", "source_node_id": "node_fe", "target_node_id": "node_qa", "condition": "success"}
            ]
        }
    },
    {
        "id": "bug_hotfix",
        "name": "Bug Hotfix Pipeline",
        "description": "Targeted fix and audit: Developer -> QA Tester -> Security Reviewer",
        "nodes_count": 3,
        "edges_count": 2,
        "layout_data": {
            "nodes": [
                {
                    "id": "node_be",
                    "preset_id": "backend",
                    "role_name": "Backend Developer",
                    "node_type": "backend",
                    "color_theme": "#3b82f6",
                    "icon": "Server",
                    "position_x": 100.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["backend"]["default_system_prompt"],
                    "task_prompt": "Investigate bug and implement targeted hotfix in backend/app/.",
                    "allowed_paths": PRESET_MAP["backend"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["backend"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_qa",
                    "preset_id": "qa",
                    "role_name": "QA & Automation Tester",
                    "node_type": "qa",
                    "color_theme": "#22c55e",
                    "icon": "CheckSquare",
                    "position_x": 380.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["qa"]["default_system_prompt"],
                    "task_prompt": "Verify hotfix and execute regression tests in tests/.",
                    "allowed_paths": PRESET_MAP["qa"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["qa"]["default_read_only_paths"],
                    "require_human_approval": False
                },
                {
                    "id": "node_sec",
                    "preset_id": "security",
                    "role_name": "Security / Code Reviewer",
                    "node_type": "security",
                    "color_theme": "#f43f5e",
                    "icon": "ShieldAlert",
                    "position_x": 660.0,
                    "position_y": 200.0,
                    "system_prompt": PRESET_MAP["security"]["default_system_prompt"],
                    "task_prompt": "Verify patch does not introduce security vulnerabilities.",
                    "allowed_paths": PRESET_MAP["security"]["default_allowed_paths"],
                    "read_only_paths": PRESET_MAP["security"]["default_read_only_paths"],
                    "require_human_approval": False
                }
            ],
            "edges": [
                {"id": "e_be_qa", "source_node_id": "node_be", "target_node_id": "node_qa", "condition": "success"},
                {"id": "e_qa_sec", "source_node_id": "node_qa", "target_node_id": "node_sec", "condition": "success"}
            ]
        }
    }
]

TEMPLATE_MAP: Dict[str, Dict[str, Any]] = {t["id"]: t for t in WORKFLOW_TEMPLATES}


def seed_presets_and_templates() -> None:
    """Populate database tables with preset and template data if empty."""
    with db_session() as conn:
        cursor = conn.cursor()

        # Seed Presets
        for p in ENTERPRISE_AGENT_PRESETS:
            cursor.execute(
                """
                INSERT OR REPLACE INTO agent_presets (
                    id, role_name, icon, color_theme,
                    default_system_prompt, default_allowed_paths, default_read_only_paths
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    p["id"],
                    p["role_name"],
                    p["icon"],
                    p["color_theme"],
                    p["default_system_prompt"],
                    json.dumps(p["default_allowed_paths"]),
                    json.dumps(p["default_read_only_paths"]),
                )
            )

        # Seed Templates
        for t in WORKFLOW_TEMPLATES:
            cursor.execute(
                """
                INSERT OR REPLACE INTO workflow_templates (
                    id, name, description, layout_data
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    t["id"],
                    t["name"],
                    t["description"],
                    json.dumps(t["layout_data"]),
                )
            )
