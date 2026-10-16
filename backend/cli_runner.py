"""CLI Subprocess Supervisor & Mock Simulator for Gemini Workflow Studio.

Executes real Gemini CLI sessions or provides realistic Mock CLI execution
with streaming terminal logs, strict scope prompt injection, and deliberate
scope violation simulation for testing Git Diff audit and approval workflows.
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional

# Type for log streaming callback: (stream_type, chunk, seq_order) -> Awaitable[None]
LogCallback = Callable[[str, str, int], Awaitable[None]]


def inject_strict_scope_rules(
    system_prompt: str,
    task_prompt: str,
    allowed_paths: List[str],
    read_only_paths: List[str]
) -> str:
    """Inject strict architectural boundary enforcement instructions into the LLM prompt."""
    allowed_list_str = "\n".join(f"  - {p}" for p in allowed_paths) if allowed_paths else "  - (No allowed write paths)"
    readonly_list_str = "\n".join(f"  - {p}" for p in read_only_paths) if read_only_paths else "  - (None)"

    scope_block = f"""

================================================================================
[STRICT SCOPE ENFORCEMENT RULES — MANDATORY]
1. You are strictly restricted to creating or editing files matching these patterns:
{allowed_list_str}

2. You may READ but NEVER modify or delete files matching:
{readonly_list_str}

3. Any file modification outside allowed paths will be immediately detected
   by the Automated Git Diff Auditor, triggering an emergency VIOLATION_PAUSED
   state and automatic rollback.
================================================================================
"""
    return f"{system_prompt.strip()}\n\n{task_prompt.strip()}\n\n{scope_block.strip()}"


class CLIRunner:
    """Executes agent workloads either via real Gemini CLI or mock simulation."""

    def __init__(self, cli_binary: Optional[str] = None):
        self.cli_binary = cli_binary or os.environ.get("GEMINI_CLI_PATH", "gemini")

    async def run_node(
        self,
        node: Dict[str, Any],
        workspace_dir: str,
        on_log: LogCallback,
        mock_mode: bool = True,
        simulate_violation: bool = False,
    ) -> bool:
        """Run a single DAG node task.
        
        Args:
            node: Node configuration dict.
            workspace_dir: Absolute path of target codebase.
            on_log: Async callback function for terminal output streaming.
            mock_mode: If True, execute simulation without calling external CLI.
            simulate_violation: If True, purposely modify an unauthorized file.
            
        Returns:
            bool: True if execution succeeded, False if failed.
        """
        if mock_mode:
            return await self._run_mock_mode(node, workspace_dir, on_log, simulate_violation)
        else:
            return await self._run_real_cli(node, workspace_dir, on_log)

    async def _run_mock_mode(
        self,
        node: Dict[str, Any],
        workspace_dir: str,
        on_log: LogCallback,
        simulate_violation: bool
    ) -> bool:
        """Simulate Gemini CLI execution with realistic terminal output and deliberate violations."""
        seq = 1
        node_id = node.get("id", "unknown_node")
        role_name = node.get("role_name", "AI Agent")
        allowed_paths = node.get("allowed_paths", [])
        read_only_paths = node.get("read_only_paths", [])
        task_prompt = node.get("task_prompt", "")

        async def emit(text: str, stream: str = "stdout"):
            nonlocal seq
            await on_log(stream, text, seq)
            seq += 1

        await emit(f"[SYSTEM] Initializing Gemini CLI Session for {role_name} (Node: {node_id})...\n")
        await asyncio.sleep(0.3)

        await emit(f"[WORKSPACE] Target codebase: {workspace_dir}\n")
        await emit(f"[STRICT-SCOPE] Allowed write paths:\n")
        for p in allowed_paths:
            await emit(f"  -> {p}\n")
        if read_only_paths:
            await emit(f"[STRICT-SCOPE] Read-only paths:\n")
            for p in read_only_paths:
                await emit(f"  -> {p}\n")

        await asyncio.sleep(0.4)
        await emit(f"[PROMPT] Processing task: {task_prompt}\n")
        await asyncio.sleep(0.5)

        await emit("[ANALYSIS] Scanning AST and project architecture...\n")
        await asyncio.sleep(0.4)
        await emit("[GENERATION] LLM reasoning stream started...\n")
        await asyncio.sleep(0.3)

        # 1. Apply a legitimate mock file modification in an allowed path
        valid_written_file: Optional[str] = None
        if allowed_paths:
            # Pick first pattern and create a clean mock path
            first_pat = allowed_paths[0].replace("**", "").rstrip("/")
            if first_pat.endswith(".md"):
                valid_rel = first_pat
            elif "." in os.path.basename(first_pat):
                valid_rel = first_pat
            else:
                valid_rel = f"{first_pat}/generated_artifact_{node_id}.txt"

            valid_full = os.path.join(workspace_dir, valid_rel)
            try:
                os.makedirs(os.path.dirname(valid_full), exist_ok=True)
                with open(valid_full, "a", encoding="utf-8") as f:
                    f.write(f"\n# Auto-generated by {role_name} at {datetime.now(timezone.utc).isoformat()}\n")
                valid_written_file = valid_rel
                await emit(f"[FILE-WRITE] Modified authorized file: {valid_rel}\n")
            except Exception as e:
                await emit(f"[WARN] Failed to write authorized mock file: {e}\n", stream="stderr")

        await asyncio.sleep(0.4)

        # 2. Deliberate Scope Violation simulation
        # If requested or if node specifically indicates simulation
        should_violate = simulate_violation or node.get("simulate_violation", False) or "[SIMULATE_VIOLATION]" in task_prompt

        if should_violate:
            # Choose an unauthorized file that does not match node's allowed_paths
            unauthorized_candidate = "frontend/src/App.tsx"
            if any("frontend" in p for p in allowed_paths):
                unauthorized_candidate = "backend/app/unauthorized_leak.py"

            unauthorized_full = os.path.join(workspace_dir, unauthorized_candidate)
            try:
                os.makedirs(os.path.dirname(unauthorized_full), exist_ok=True)
                with open(unauthorized_full, "a", encoding="utf-8") as f:
                    f.write(f"\n// [MOCK SCOPE VIOLATION] Unauthorized edit by {role_name} ({node_id})\nimport {{ UnauthorizedExport }} from './leak';\n")

                await emit(f"[MOCK-SIMULATOR] Intentionally modifying unauthorized path: {unauthorized_candidate}\n", stream="stderr")
                await emit(f"[MOCK-SIMULATOR] This simulates an LLM hallucination exceeding scope for Git Auditor test!\n", stream="stderr")
            except Exception as e:
                await emit(f"[WARN] Could not simulate unauthorized write: {e}\n", stream="stderr")

        await asyncio.sleep(0.4)
        await emit(f"[COMPLETE] Session finished with status code 0 (Success).\n")
        return True

    async def _run_real_cli(
        self,
        node: Dict[str, Any],
        workspace_dir: str,
        on_log: LogCallback
    ) -> bool:
        """Run actual Gemini CLI subprocess, streaming stdout and stderr asynchronously."""
        seq = 1
        node_id = node.get("id", "unknown_node")
        role_name = node.get("role_name", "AI Agent")
        system_prompt = node.get("system_prompt", "")
        task_prompt = node.get("task_prompt", "")
        allowed_paths = node.get("allowed_paths", [])
        read_only_paths = node.get("read_only_paths", [])

        full_prompt = inject_strict_scope_rules(
            system_prompt=system_prompt,
            task_prompt=task_prompt,
            allowed_paths=allowed_paths,
            read_only_paths=read_only_paths,
        )

        async def emit(text: str, stream: str = "stdout"):
            nonlocal seq
            await on_log(stream, text, seq)
            seq += 1

        await emit(f"[PROCESS] Spawning Gemini CLI process: '{self.cli_binary}' in {workspace_dir}...\n")

        # Build CLI command: passing prompt via argument or stdin
        cmd = [self.cli_binary, full_prompt]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=workspace_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            async def read_stream(stream, stream_type: str):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode("utf-8", errors="replace")
                    await emit(decoded, stream=stream_type)

            await asyncio.gather(
                read_stream(process.stdout, "stdout"),
                read_stream(process.stderr, "stderr"),
            )

            returncode = await process.wait()
            if returncode == 0:
                await emit(f"[PROCESS] Process exited normally with code {returncode}.\n")
                return True
            else:
                await emit(f"[PROCESS] Process exited with error code {returncode}.\n", stream="stderr")
                return False

        except FileNotFoundError:
            await emit(
                f"[ERROR] Gemini CLI binary '{self.cli_binary}' not found on system PATH.\n"
                f"[TIP] Set GEMINI_CLI_PATH or run in Mock Mode for testing.\n",
                stream="stderr"
            )
            return False
        except Exception as e:
            await emit(f"[ERROR] Exception running subprocess: {e}\n", stream="stderr")
            return False


# Global CLI runner singleton
cli_runner = CLIRunner()
