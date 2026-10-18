"""Automated Git Diff Auditor for Gemini Workflow Studio.

Captures workspace git snapshots, detects modifications and new untracked files,
verifies paths against allowed glob patterns, extracts unified diffs for unauthorized
changes, and safely reverts scope violations.
"""

from __future__ import annotations

import difflib
import fnmatch
import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path, PurePath
from typing import Any, Dict, List, Optional, Tuple


def normalize_posix_path(path_str: str) -> str:
    """Normalize file path to POSIX forward slash style cross-platform.
    Strips quotes, trims whitespace, and converts backslashes to forward slashes.
    """
    cleaned = path_str.strip().strip('"').strip("'").replace("\\", "/")
    return PurePath(cleaned).as_posix()


def is_path_allowed(file_path: str, allowed_patterns: List[str]) -> bool:
    """Check if a file path matches any of the allowed glob patterns.
    
    Supports:
    - Standard fnmatch globs: e.g. "backend/services/**", "frontend/src/*.tsx"
    - Directory prefixes: e.g. "backend/app/", "tests"
    - Exact filenames: e.g. "api_spec.md", "README.md"
    """
    if not allowed_patterns:
        return False

    norm_path = normalize_posix_path(file_path)

    for pattern in allowed_patterns:
        norm_pattern = normalize_posix_path(pattern)

        # Exact match
        if norm_path == norm_pattern:
            return True

        # Standard fnmatch match
        if fnmatch.fnmatch(norm_path, norm_pattern):
            return True

        # Directory prefix handling (e.g., 'backend/' or 'backend/**')
        clean_prefix = norm_pattern.rstrip('*').rstrip('/')
        if clean_prefix:
            if norm_path == clean_prefix or norm_path.startswith(clean_prefix + "/"):
                return True

    return False


@dataclass
class GitFileDiff:
    """Unified git diff representation for a single file."""
    file_path: str
    status: str  # 'modified' | 'added' | 'deleted' | 'renamed'
    diff_text: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "file_path": self.file_path,
            "status": self.status,
            "diff_text": self.diff_text,
        }


@dataclass
class AuditResult:
    """Result of scope audit comparing workspace against snapshot and allowed paths."""
    valid_files: List[str] = field(default_factory=list)
    unauthorized_files: List[str] = field(default_factory=list)
    diffs: List[Dict[str, str]] = field(default_factory=list)

    # Support tuple unpacking: valid_files, unauthorized_files, diffs = audit_result
    def __iter__(self):
        yield self.valid_files
        yield self.unauthorized_files
        yield self.diffs

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid_files": self.valid_files,
            "unauthorized_files": self.unauthorized_files,
            "diffs": self.diffs,
        }


class GitScopeAuditor:
    """Manages pre-execution workspace snapshots, delta analysis,
    and automatic violation rollbacks.
    """

    def __init__(self, git_binary: str = "git"):
        self.git_binary = git_binary

    def validate_git_repository(self, project_dir: str) -> Tuple[bool, Optional[str]]:
        """Validate that target_project_dir is an initialized Git repository with an initial commit.
        
        Returns:
            Tuple[bool, Optional[str]]: (is_valid, error_message_or_none)
        """
        if not project_dir or not str(project_dir).strip():
            return False, "Đường dẫn thư mục dự án trống."

        cleaned = str(project_dir).strip().strip('"').strip("'").strip()
        abs_path = os.path.abspath(cleaned)

        if not os.path.exists(abs_path):
            return False, f"Thư mục dự án không tồn tại: '{cleaned}'"

        if not os.path.isdir(abs_path):
            return False, f"Đường dẫn dự án không phải là thư mục: '{cleaned}'"

        # Check if git repository exists
        code, out, err = self._run_git(abs_path, ["rev-parse", "--is-inside-work-tree"])
        if code != 0 or out.strip() != "true":
            return False, (
                f"Thư mục '{abs_path}' chưa được khởi tạo Git (.git). "
                "Vui lòng chạy 'git init' và tạo commit đầu tiên trước khi thực thi workflow để Git Diff Auditor có thể theo dõi thay đổi."
            )

        # Check if HEAD commit exists
        code, out, err = self._run_git(abs_path, ["rev-parse", "--verify", "HEAD"])
        if code != 0:
            return False, (
                f"Thư mục Git '{abs_path}' chưa có commit đầu tiên. "
                "Vui lòng tạo ít nhất một commit ban đầu (ví dụ: 'git add . && git commit -m \"Initial commit\"') "
                "để Git Diff Auditor có mốc so sánh (HEAD)."
            )

        return True, None

    def _run_git(self, project_dir: str, args: List[str]) -> Tuple[int, str, str]:
        """Execute a git command within the specified project directory."""
        try:
            res = subprocess.run(
                [self.git_binary, *args],
                cwd=project_dir,
                capture_output=True,
                text=True,
                check=False,
                encoding="utf-8",
                errors="replace",
            )
            return res.returncode, res.stdout, res.stderr
        except Exception as e:
            return -1, "", str(e)

    def _parse_porcelain(self, raw_status: str) -> Dict[str, str]:
        """Parse `git status --porcelain` output into a dict of {posix_file_path: status_code}."""
        status_map: Dict[str, str] = {}
        for line in raw_status.splitlines():
            # Preserve columns 0 and 1; do not strip before reading code
            if not line or len(line) < 3:
                continue
            code = line[:2].strip()
            path_part = line[2:].strip()
            if "->" in path_part:
                path_part = path_part.split("->")[-1].strip()
            norm = normalize_posix_path(path_part)
            if norm:
                status_map[norm] = code
        return status_map

    def capture_snapshot(self, project_dir: str) -> Dict[str, str]:
        """Record the state of all dirty, staged, and untracked files before Agent execution.
        
        Returns:
            Dict[str, str]: Map of normalized file paths to their git status codes.
        """
        code, stdout, _ = self._run_git(project_dir, ["status", "--porcelain", "-uall"])
        if code != 0:
            # If not a git repository or git error, return empty snapshot
            return {}
        return self._parse_porcelain(stdout)

    def audit_changes(
        self,
        project_dir: str,
        snapshot: Dict[str, str],
        allowed_paths: List[str],
        ignored_paths: Optional[List[str]] = None,
        already_verified_files: Optional[List[str]] = None,
    ) -> AuditResult:
        """Evaluate files changed or created during the agent run against allowed paths.
        
        Args:
            project_dir: Root directory of git workspace.
            snapshot: Snapshot dictionary captured before running.
            allowed_paths: List of allowed glob patterns.
            ignored_paths: Optional list of glob patterns owned by other concurrent nodes to ignore.
            already_verified_files: Optional list of files legitimately modified by earlier nodes.
            
        Returns:
            AuditResult containing valid_files, unauthorized_files, and diffs.
        """
        code, stdout, _ = self._run_git(project_dir, ["status", "--porcelain", "-uall"])
        current_status = self._parse_porcelain(stdout) if code == 0 else {}

        # Determine delta: files that were modified or created during this run
        delta_files: Dict[str, str] = {}

        # 1. Any file currently dirty that wasn't dirty in snapshot
        for path, code_str in current_status.items():
            if path not in snapshot or snapshot[path] != code_str:
                delta_files[path] = code_str

        # 2. Also check if file is tracked and had unstaged/staged diffs generated
        # In case status code stayed 'M' but content was changed
        for path in current_status:
            if path in snapshot and snapshot[path] == current_status[path]:
                # Inspect git diff to see if this file has changes
                diff_code, diff_out, _ = self._run_git(project_dir, ["diff", "--", path])
                if diff_code == 0 and diff_out.strip():
                    delta_files[path] = current_status[path]

        valid_files: List[str] = []
        unauthorized_files: List[str] = []
        diffs: List[Dict[str, str]] = []
        ignored = ignored_paths or []
        verified = set(already_verified_files or [])

        for file_path, status_code in delta_files.items():
            if file_path in verified:
                # File was already legitimately generated and verified by another node in this execution
                continue

            if is_path_allowed(file_path, allowed_paths):
                valid_files.append(file_path)
            elif is_path_allowed(file_path, ignored):
                # Ignore files modified by other concurrently executing nodes
                continue
            else:
                unauthorized_files.append(file_path)
                diff_obj = self._extract_diff(project_dir, file_path, status_code)
                diffs.append(diff_obj.to_dict())

        return AuditResult(
            valid_files=valid_files,
            unauthorized_files=unauthorized_files,
            diffs=diffs,
        )

    def _extract_diff(self, project_dir: str, file_path: str, status_code: str) -> GitFileDiff:
        """Extract or synthesize unified git diff for an unauthorized file."""
        full_path = os.path.join(project_dir, file_path)

        # Determine diff status category
        if "??" in status_code or "A" in status_code:
            diff_status = "added"
        elif "D" in status_code:
            diff_status = "deleted"
        elif "R" in status_code:
            diff_status = "renamed"
        else:
            diff_status = "modified"

        # Try standard git diff first (for tracked files)
        code, stdout, _ = self._run_git(project_dir, ["diff", "HEAD", "--", file_path])
        diff_text = stdout.strip()

        if not diff_text:
            code, stdout, _ = self._run_git(project_dir, ["diff", "--", file_path])
            diff_text = stdout.strip()

        # If diff is still empty (e.g. untracked new file or staged new file)
        if not diff_text and os.path.exists(full_path) and os.path.isfile(full_path):
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content_lines = f.readlines()
                gen_diff = difflib.unified_diff(
                    [],
                    content_lines,
                    fromfile=f"a/{file_path}",
                    tofile=f"b/{file_path}",
                    lineterm="\n",
                )
                diff_text = "".join(gen_diff).strip()
            except Exception as e:
                diff_text = f"--- /dev/null\n+++ b/{file_path}\n@@ -0,0 +1 @@\n+<Unable to read content: {e}>"

        if not diff_text:
            diff_text = f"--- a/{file_path}\n+++ b/{file_path}\n@@ (status: {diff_status}) @@"

        return GitFileDiff(
            file_path=file_path,
            status=diff_status,
            diff_text=diff_text,
        )

    def revert_unauthorized_files(
        self,
        project_dir: str,
        unauthorized_files: List[str]
    ) -> List[str]:
        """Roll back unauthorized changes by checking out tracked files or deleting untracked files.
        
        Args:
            project_dir: Root directory of git workspace.
            unauthorized_files: List of file paths to revert.
            
        Returns:
            List[str]: List of successfully reverted files.
        """
        reverted_files: List[str] = []

        for rel_path in unauthorized_files:
            norm_rel_path = normalize_posix_path(rel_path)
            full_path = os.path.join(project_dir, norm_rel_path)

            # Check if file is untracked
            code, stdout, _ = self._run_git(project_dir, ["status", "--porcelain", "--", norm_rel_path])
            status_line = stdout.strip()

            is_untracked = status_line.startswith("??") or not status_line

            if is_untracked and os.path.exists(full_path):
                # Untracked file: safely remove from filesystem
                try:
                    if os.path.isfile(full_path) or os.path.islink(full_path):
                        os.remove(full_path)
                    elif os.path.isdir(full_path):
                        shutil.rmtree(full_path)
                    reverted_files.append(norm_rel_path)
                except Exception as e:
                    # Fallback to git clean
                    self._run_git(project_dir, ["clean", "-f", "--", norm_rel_path])
                    reverted_files.append(norm_rel_path)
            else:
                # Tracked file: unstage if needed, then restore/checkout to clean state
                self._run_git(project_dir, ["restore", "--staged", "--", norm_rel_path])
                res_code, _, _ = self._run_git(project_dir, ["restore", "--", norm_rel_path])
                if res_code != 0:
                    # Fallback to checkout
                    self._run_git(project_dir, ["checkout", "--", norm_rel_path])
                reverted_files.append(norm_rel_path)

        return reverted_files
