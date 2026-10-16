# Gemini Workflow Studio (Enterprise Multi-Agent Edition) 🚀

Visual Drag-and-Drop Workflow Builder & Multi-Agent Orchestrator for Gemini CLI.

## 📖 Core Documentation

1. **[project_context.md](project_context.md)**: 
   - Tổng quan kiến trúc hệ sinh thái Multi-Agent theo mô hình công ty phần mềm.
   - **Cơ chế Kiểm duyệt Git tự động (Automated Git Diff Auditor)**: Snapshot `git status --porcelain` trước khi chạy, so sánh `git diff` sau khi chạy, phát hiện vi phạm `allowed_paths`, trạng thái `VIOLATION_PAUSED`, tự động Rollback hoặc Approve.
   - **7 Mẫu Agent Presets chuẩn doanh nghiệp**: Product Manager, System Architect, Database Engineer, Backend Dev, Frontend Dev, QA Tester, Security Reviewer.
   - **3 Workflow Templates dựng sẵn (1-Click)**: Full-Stack SDLC Pipeline, Fast Feature Pipeline, Bug Hotfix Pipeline.
   - Database Schema v2.0 (SQL DDL & ERD).

2. **[api_spec.md](api_spec.md)**: 
   - Đặc tả chuẩn REST API (Workflows, Templates, Executions, Git Revert/Approve Endpoints).
   - Chuẩn bản tin WebSocket (`scope_violation_alert`, `node_status_update`, `terminal_log`, `lock_acquired`).
   - Shared TypeScript Interfaces sẵn sàng cho Frontend `@xyflow/react`.

## 📁 Project Structure

- `backend/`: Python 3.11+ FastAPI, WebSockets, SQLite, `asyncio.subprocess` (chạy Gemini CLI & Git commands).
- `frontend/`: React 18, Vite, TypeScript, `@xyflow/react` (React Flow), TailwindCSS, Lucide Icons.
