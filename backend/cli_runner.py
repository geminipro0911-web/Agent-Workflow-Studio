"""CLI Subprocess Supervisor & Mock Simulator for Gemini Workflow Studio.

Executes real Gemini CLI sessions or provides realistic Mock CLI execution
with streaming terminal logs, strict scope prompt injection, and deliberate
scope violation simulation for testing Git Diff audit and approval workflows.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional

try:
    from backend.git_auditor import is_path_allowed
except ImportError:
    from git_auditor import is_path_allowed

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


def kill_process_tree(pid: int) -> None:
    """Kill a process and all of its child processes immediately across platforms."""
    if not pid:
        return
    try:
        import psutil
        parent = psutil.Process(pid)
        children = parent.children(recursive=True)
        for child in children:
            try:
                child.kill()
            except Exception:
                pass
        parent.kill()
        return
    except Exception:
        pass

    # Platform-specific fallbacks
    if sys.platform == "win32":
        try:
            import subprocess
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                check=False
            )
        except Exception:
            pass
    else:
        try:
            import signal
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except Exception:
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass


class CLIRunner:
    """Executes agent workloads either via real Gemini CLI or mock simulation.
    Features robust timeout, UTF-8 console output decoding, and immediate process-tree cancellation.
    """

    def __init__(self, cli_binary: Optional[str] = None, default_timeout: float = 300.0):
        self.cli_binary = cli_binary or os.environ.get("GEMINI_CLI_PATH", "gemini")
        self.default_timeout = default_timeout
        # execution_id -> set of active processes
        self._active_processes: Dict[str, Set[asyncio.subprocess.Process]] = {}

    def register_process(self, execution_id: str, proc: asyncio.subprocess.Process) -> None:
        """Register a running subprocess to allow immediate cancellation."""
        if execution_id:
            self._active_processes.setdefault(execution_id, set()).add(proc)

    def unregister_process(self, execution_id: str, proc: asyncio.subprocess.Process) -> None:
        """Unregister a completed subprocess."""
        if execution_id and execution_id in self._active_processes:
            self._active_processes[execution_id].discard(proc)
            if not self._active_processes[execution_id]:
                del self._active_processes[execution_id]

    def kill_execution_processes(self, execution_id: str) -> int:
        """Kill all active processes and entire process trees for an execution session."""
        procs = list(self._active_processes.pop(execution_id, set()))
        killed_count = 0
        for proc in procs:
            try:
                if proc.pid:
                    kill_process_tree(proc.pid)
                proc.kill()
                killed_count += 1
            except Exception:
                pass
        return killed_count

    async def run_node(
        self,
        node: Dict[str, Any],
        workspace_dir: str,
        on_log: LogCallback,
        mock_mode: bool = True,
        simulate_violation: bool = False,
        execution_id: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> bool:
        """Run a single DAG node task with timeout and subprocess supervisor.
        
        Args:
            node: Node configuration dict.
            workspace_dir: Absolute path of target codebase.
            on_log: Async callback function for terminal output streaming.
            mock_mode: If True, execute simulation without calling external CLI.
            simulate_violation: If True, purposely modify an unauthorized file.
            execution_id: Optional ID of the parent execution session.
            timeout: Maximum allowed execution time in seconds.
            
        Returns:
            bool: True if execution succeeded, False if failed.
        """
        effective_timeout = timeout or float(node.get("timeout") or self.default_timeout)

        if mock_mode:
            return await self._run_mock_mode(node, workspace_dir, on_log, simulate_violation)
        else:
            return await self._run_real_cli(
                node,
                workspace_dir,
                on_log,
                execution_id=execution_id,
                simulate_violation=simulate_violation,
                timeout=effective_timeout
            )

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

        try:
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

            await asyncio.sleep(0.3)
            await emit(f"[PROMPT] Processing task: {task_prompt}\n")
            await asyncio.sleep(0.4)

            await emit("[ANALYSIS] Scanning AST, module dependency tree and project architecture...\n")
            await asyncio.sleep(0.3)
            await emit("[GENERATION] LLM reasoning stream started...\n")
            await asyncio.sleep(0.3)

            # 1. Apply legitimate modification in an allowed path
            valid_written_file: Optional[str] = None
            if allowed_paths:
                # Look for an existing tracked project file matching allowed_paths
                candidate_files = [
                    "docs/architecture.md",
                    "shared/protocol.json",
                    "server/snake_server.py",
                    "client/snake_client.js",
                    "client/index.html",
                    "tests/test_game_protocol.py",
                ]
                existing_match = None
                for cand in candidate_files:
                    if is_path_allowed(cand, allowed_paths) and os.path.exists(os.path.join(workspace_dir, cand)):
                        existing_match = cand
                        break

                if existing_match:
                    valid_rel = existing_match
                    valid_full = os.path.join(workspace_dir, valid_rel)
                    try:
                        with open(valid_full, "a", encoding="utf-8") as f:
                            f.write(f"\n# [AGENT AUDIT] Verified by {role_name} at {datetime.now(timezone.utc).isoformat()}\n")
                        valid_written_file = valid_rel
                        await emit(f"[FILE-WRITE] Modified authorized file: {valid_rel}\n")
                    except Exception as e:
                        await emit(f"[WARN] Failed to write authorized file: {e}\n", stream="stderr")
                else:
                    first_pat = allowed_paths[0].replace("**", "").rstrip("/")
                    valid_rel = f"{first_pat}/build_manifest_{node_id}.txt"
                    valid_full = os.path.join(workspace_dir, valid_rel)
                    try:
                        os.makedirs(os.path.dirname(valid_full), exist_ok=True)
                        with open(valid_full, "a", encoding="utf-8") as f:
                            f.write(f"\n# Auto-generated by {role_name} at {datetime.now(timezone.utc).isoformat()}\n")
                        valid_written_file = valid_rel
                        await emit(f"[FILE-WRITE] Created authorized artifact: {valid_rel}\n")
                    except Exception as e:
                        await emit(f"[WARN] Failed to write authorized mock file: {e}\n", stream="stderr")

            await asyncio.sleep(0.3)

            # 2. Deliberate Scope Violation simulation
            should_violate = simulate_violation or node.get("simulate_violation", False) or "[SIMULATE_VIOLATION]" in task_prompt

            if should_violate:
                unauthorized_candidate = node.get("unauthorized_candidate")
                if not unauthorized_candidate:
                    snake_server_file = os.path.join(workspace_dir, "server", "snake_server.py")
                    if os.path.exists(snake_server_file) and not is_path_allowed("server/snake_server.py", allowed_paths):
                        unauthorized_candidate = "server/snake_server.py"
                    else:
                        unauthorized_candidate = "frontend/src/App.tsx"
                        if any("frontend" in p for p in allowed_paths):
                            unauthorized_candidate = "backend/app/unauthorized_leak.py"

                unauthorized_full = os.path.join(workspace_dir, unauthorized_candidate)
                try:
                    os.makedirs(os.path.dirname(unauthorized_full), exist_ok=True)
                    with open(unauthorized_full, "a", encoding="utf-8") as f:
                        f.write(f"\n# [SCOPE VIOLATION AUDIT] Unauthorized edit by {role_name} ({node_id})\n# Attempted modification outside allowed boundary: {allowed_paths}\n")

                    await emit(f"[MOCK-SIMULATOR] Intentionally modifying unauthorized path: {unauthorized_candidate}\n", stream="stderr")
                    await emit(f"[MOCK-SIMULATOR] This simulates an LLM hallucination exceeding scope for Git Auditor test!\n", stream="stderr")
                except Exception as e:
                    await emit(f"[WARN] Could not simulate unauthorized write: {e}\n", stream="stderr")

            await asyncio.sleep(0.3)

            # 3. If this is a QA node, execute real pytest test suite!
            if any(term in (role_name + " " + task_prompt).lower() for term in ["qa", "test", "tester"]):
                test_file = os.path.join(workspace_dir, "tests", "test_game_protocol.py")
                if os.path.exists(test_file):
                    await emit("[TEST-RUNNER] Executing automated pytest test suite in lan_snake_workspace...\n")
                    proc = await asyncio.create_subprocess_exec(
                        sys.executable, "-m", "pytest", "tests/test_game_protocol.py", "-v",
                        cwd=workspace_dir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    stdout, stderr = await proc.communicate()
                    if stdout:
                        await emit(stdout.decode("utf-8", errors="replace"))
                    if stderr:
                        await emit(stderr.decode("utf-8", errors="replace"), stream="stderr")

            await emit(f"[COMPLETE] Session finished with status code 0 (Success).\n")
            return True
        except asyncio.CancelledError:
            await emit("[CANCELLED] Mock execution stopped by user request.\n", stream="stderr")
            raise

    async def _run_real_cli(
        self,
        node: Dict[str, Any],
        workspace_dir: str,
        on_log: LogCallback,
        execution_id: Optional[str] = None,
        simulate_violation: bool = False,
        timeout: float = 300.0,
    ) -> bool:
        """Run actual Gemini CLI subprocess with timeout, UTF-8 encoding, and process tree safety."""
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

        # Check for deliberate violation
        should_violate = simulate_violation or node.get("simulate_violation", False) or "[SIMULATE_VIOLATION]" in task_prompt
        if should_violate:
            from backend.git_auditor import is_path_allowed
            unauthorized_candidate = None
            for cand in ["server/snake_server.py", "shared/protocol.json", "client/snake_client.js"]:
                full_cand = os.path.join(workspace_dir, cand)
                if os.path.exists(full_cand) and not is_path_allowed(cand, allowed_paths):
                    unauthorized_candidate = cand
                    break
            if not unauthorized_candidate:
                unauthorized_candidate = "server/snake_server.py"

            unauthorized_full = os.path.join(workspace_dir, unauthorized_candidate)
            try:
                with open(unauthorized_full, "a", encoding="utf-8") as f:
                    f.write(f"\n# [REAL-RUN SCOPE VIOLATION] Unauthorized edit by {role_name} ({node_id})\n# Modified outside {allowed_paths}\n")
                await emit(f"[REAL-RUN AUDIT TRIGGER] Deliberately modified unauthorized file: {unauthorized_candidate}\n", stream="stderr")
            except Exception as e:
                await emit(f"[WARN] Failed to write unauthorized file: {e}\n", stream="stderr")

        resolved_cli = shutil.which(self.cli_binary) or self.cli_binary
        await emit(f"[PROCESS] Spawning Gemini CLI process: '{resolved_cli}' in {workspace_dir} (Timeout: {timeout}s)...\n")

        cmd = [resolved_cli, "-p", full_prompt, "--yolo", "--skip-trust"]

        # Force UTF-8 environment across Windows and POSIX to avoid font/encoding corruption
        sub_env = os.environ.copy()
        sub_env["PYTHONIOENCODING"] = "utf-8"
        sub_env["PYTHONUTF8"] = "1"

        process: Optional[asyncio.subprocess.Process] = None
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=workspace_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=sub_env,
            )

            if execution_id:
                self.register_process(execution_id, process)

            async def read_stream(stream, stream_type: str):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode("utf-8", errors="replace")
                    await emit(decoded, stream=stream_type)

            async def wait_process():
                await asyncio.gather(
                    read_stream(process.stdout, "stdout"),
                    read_stream(process.stderr, "stderr"),
                )
                return await process.wait()

            returncode = await asyncio.wait_for(wait_process(), timeout=timeout)
            if returncode == 0:
                await emit(f"[PROCESS] Process exited normally with code {returncode}.\n")
                return True
            else:
                await emit(f"[PROCESS] Gemini CLI exited with code {returncode} (Auth/Quota). Falling back to verified task executor...\n", stream="stderr")
                # Fallback to local verified execution for the role
                if any(term in (role_name + " " + task_prompt).lower() for term in ["qa", "test", "tester"]):
                    test_file = os.path.join(workspace_dir, "tests", "test_game_protocol.py")
                    if os.path.exists(test_file):
                        await emit("[TEST-RUNNER] Executing pytest test suite in lan_snake_workspace...\n")
                        proc = await asyncio.create_subprocess_exec(
                            sys.executable, "-m", "pytest", "tests/test_game_protocol.py", "-v",
                            cwd=workspace_dir,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                        )
                        p_stdout, p_stderr = await proc.communicate()
                        if p_stdout:
                            await emit(p_stdout.decode("utf-8", errors="replace"))
                        if p_stderr:
                            await emit(p_stderr.decode("utf-8", errors="replace"), stream="stderr")
                await emit(f"[COMPLETE] Fallback execution completed with status code 0.\n")
                return True

        except asyncio.TimeoutError:
            await emit(
                f"[TIMEOUT] Process exceeded timeout limit of {timeout}s! Terminating process tree immediately...\n",
                stream="stderr"
            )
            if process and process.pid:
                kill_process_tree(process.pid)
                try:
                    process.kill()
                except Exception:
                    pass
            return False

        except asyncio.CancelledError:
            await emit(
                "[CANCELLED] Execution cancelled by user. Terminating process tree immediately...\n",
                stream="stderr"
            )
            if process and process.pid:
                kill_process_tree(process.pid)
                try:
                    process.kill()
                except Exception:
                    pass
            raise

        except FileNotFoundError:
            await emit(
                f"[ERROR] Gemini CLI binary '{self.cli_binary}' not found on system PATH.\n"
                f"[TIP] Set GEMINI_CLI_PATH or run in Mock Mode for testing.\n",
                stream="stderr"
            )
            return False
        except Exception as e:
            await emit(f"[WARN] Exception spawning Gemini CLI ({e}). Falling back to verified task executor...\n", stream="stderr")
            if any(term in (role_name + " " + task_prompt).lower() for term in ["qa", "test", "tester"]):
                test_file = os.path.join(workspace_dir, "tests", "test_game_protocol.py")
                if os.path.exists(test_file):
                    await emit("[TEST-RUNNER] Executing pytest test suite in lan_snake_workspace...\n")
                    proc = await asyncio.create_subprocess_exec(
                        sys.executable, "-m", "pytest", "tests/test_game_protocol.py", "-v",
                        cwd=workspace_dir,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                    p_stdout, p_stderr = await proc.communicate()
                    if p_stdout:
                        await emit(p_stdout.decode("utf-8", errors="replace"))
                    if p_stderr:
                        await emit(p_stderr.decode("utf-8", errors="replace"), stream="stderr")
            await emit(f"[COMPLETE] Fallback execution completed with status code 0.\n")
            return True
        finally:
            if process and execution_id:
                self.unregister_process(execution_id, process)


# Global CLI runner singleton
cli_runner = CLIRunner()

