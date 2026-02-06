import asyncio
import uuid
import os
import base64
from dataclasses import dataclass, field
from datetime import datetime, timezone

from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage
from claude_agent_sdk.types import StreamEvent

from config import COMPOSIO_API_KEY, GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO

# Composio setup — mirrors github_issues.py pattern
USE_COMPOSIO = bool(COMPOSIO_API_KEY)
if USE_COMPOSIO:
    try:
        from composio import Composio
        composio_client = Composio(api_key=COMPOSIO_API_KEY)
    except Exception:
        USE_COMPOSIO = False
        composio_client = None


# ── In-memory job store ────────────────────────────

@dataclass
class BuildJob:
    build_id: str
    issue_number: int
    status: str = "queued"  # queued → cloning → running → pushing → completed | failed
    logs: list[dict] = field(default_factory=list)
    pr_url: str | None = None
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


_jobs: dict[str, BuildJob] = {}

WORKSPACE_ROOT = "/tmp/agent-workspace"


def _log(job: BuildJob, log_type: str, message: str):
    job.logs.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": log_type,
        "message": message,
    })


# ── Workspace management ──────────────────────────

async def ensure_workspace() -> str:
    """Clone target repo once, pull on subsequent calls. Returns workspace path."""
    workspace = os.path.join(WORKSPACE_ROOT, GITHUB_REPO)

    if os.path.isdir(os.path.join(workspace, ".git")):
        proc = await asyncio.create_subprocess_exec(
            "git", "checkout", "main",
            cwd=workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
        proc = await asyncio.create_subprocess_exec(
            "git", "pull", "--ff-only",
            cwd=workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await proc.communicate()
    else:
        os.makedirs(WORKSPACE_ROOT, exist_ok=True)
        clone_url = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}.git"
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", clone_url, workspace,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"git clone failed: {stderr.decode()}")

    return workspace


# ── Composio GitHub helpers ───────────────────────

def _composio_exec(slug: str, arguments: dict) -> dict:
    """Execute a Composio GitHub action."""
    result = composio_client.tools.execute(
        slug=slug,
        arguments=arguments,
        user_id="default",
        dangerously_skip_version_check=True,
    )
    data = result.get("data", result)
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError(f"Composio {slug} failed: {result['error']}")
    return data


def _commit_files_to_branch(branch_name: str, message: str, upserts: list[dict]):
    """Create branch from main and commit files atomically via Composio.

    GITHUB_COMMIT_MULTIPLE_FILES handles branch creation when base_branch is set.
    This replaces the need for separate get-SHA + create-ref calls.
    """
    _composio_exec("GITHUB_COMMIT_MULTIPLE_FILES", {
        "owner": GITHUB_OWNER,
        "repo": GITHUB_REPO,
        "branch": branch_name,
        "base_branch": "main",
        "message": message,
        "upserts": upserts,
    })


def _create_pull_request(branch_name: str, title: str, body: str) -> dict:
    """Create a pull request via Composio. Returns PR data."""
    data = _composio_exec("GITHUB_CREATE_A_PULL_REQUEST", {
        "owner": GITHUB_OWNER,
        "repo": GITHUB_REPO,
        "head": branch_name,
        "base": "main",
        "title": title,
        "body": body,
    })
    return data


# ── Raw GitHub API fallbacks ─────────────────────

async def _get_main_branch_sha_api() -> str:
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/git/ref/heads/main",
            headers={"Authorization": f"token {GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
        )
        resp.raise_for_status()
        return resp.json()["object"]["sha"]


async def _create_branch_api(branch_name: str, sha: str):
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/git/refs",
            json={"ref": f"refs/heads/{branch_name}", "sha": sha},
            headers={"Authorization": f"token {GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
        )
        resp.raise_for_status()


async def _commit_files_api(branch_name: str, message: str, upserts: list[dict]):
    """Commit files one at a time via the GitHub Contents API."""
    import httpx
    async with httpx.AsyncClient() as client:
        for file_info in upserts:
            path = file_info["path"]
            content = file_info["content"]
            encoded = base64.b64encode(content.encode()).decode()

            # Check if file exists to get its SHA
            sha = None
            check = await client.get(
                f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{path}?ref={branch_name}",
                headers={"Authorization": f"token {GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
            )
            if check.status_code == 200:
                sha = check.json().get("sha")

            payload = {
                "message": message,
                "content": encoded,
                "branch": branch_name,
            }
            if sha:
                payload["sha"] = sha

            resp = await client.put(
                f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{path}",
                json=payload,
                headers={"Authorization": f"token {GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
            )
            resp.raise_for_status()


async def _create_pull_request_api(branch_name: str, title: str, body: str) -> dict:
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/pulls",
            json={"head": branch_name, "base": "main", "title": title, "body": body},
            headers={"Authorization": f"token {GITHUB_PAT}", "Accept": "application/vnd.github.v3+json"},
        )
        resp.raise_for_status()
        return resp.json()


# ── Collect changed files from workspace ─────────

async def _collect_changed_files(workspace: str) -> list[dict]:
    """Use git diff to find modified/added files and read their contents."""
    proc = await asyncio.create_subprocess_exec(
        "git", "diff", "--name-only", "HEAD",
        cwd=workspace,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    changed = stdout.decode().strip().splitlines()

    # Also include untracked files
    proc = await asyncio.create_subprocess_exec(
        "git", "ls-files", "--others", "--exclude-standard",
        cwd=workspace,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await proc.communicate()
    untracked = stdout.decode().strip().splitlines()

    all_files = list(set(changed + untracked))
    upserts = []
    for rel_path in all_files:
        if not rel_path:
            continue
        abs_path = os.path.join(workspace, rel_path)
        if os.path.isfile(abs_path):
            try:
                with open(abs_path, "r") as f:
                    content = f.read()
                upserts.append({"path": rel_path, "content": content})
            except (UnicodeDecodeError, OSError):
                pass  # Skip binary files

    return upserts


# ── Agent prompt ──────────────────────────────────

def _build_prompt(
    issue_number: int,
    issue_title: str,
    issue_body: str,
    implementation_guide: str,
    insight_description: str,
    suggested_action: str,
) -> str:
    return f"""You are an autonomous software engineer. Your task is to implement a GitHub issue.

## Issue #{issue_number}: {issue_title}

{issue_body}

## Additional Context

**Insight:** {insight_description}
**Suggested Action:** {suggested_action}

## Implementation Guide

{implementation_guide if implementation_guide else "No implementation guide available. Use your best judgment."}

## Instructions

1. **Read the codebase** — Explore the repo structure, read relevant files, understand the architecture before making changes.
2. **Implement the changes** — Write clean, well-structured code that addresses the issue. Follow existing code patterns and conventions.
3. **Test your changes** — If there are existing tests, run them. Make sure your changes don't break anything.

IMPORTANT:
- Do NOT run any git commands (no git add, commit, push, etc.). The system will handle git operations after you finish.
- Do NOT ask for user input or confirmation. Work autonomously.
- Keep changes focused on the issue. Do not refactor unrelated code.
- If you encounter an error, try to fix it. If you truly cannot proceed, explain why.
- When you are done, write a brief summary of what you changed and why.
"""


# ── Core build logic ─────────────────────────────

def get_job(build_id: str) -> BuildJob | None:
    return _jobs.get(build_id)


def start_build(
    issue_number: int,
    issue_title: str,
    issue_body: str,
    implementation_guide: str = "",
    insight_description: str = "",
    suggested_action: str = "",
) -> BuildJob:
    build_id = str(uuid.uuid4())
    job = BuildJob(build_id=build_id, issue_number=issue_number)
    _jobs[build_id] = job

    asyncio.create_task(_run_agent(
        job,
        issue_number=issue_number,
        issue_title=issue_title,
        issue_body=issue_body,
        implementation_guide=implementation_guide,
        insight_description=insight_description,
        suggested_action=suggested_action,
    ))

    return job


async def _run_agent(
    job: BuildJob,
    *,
    issue_number: int,
    issue_title: str,
    issue_body: str,
    implementation_guide: str,
    insight_description: str,
    suggested_action: str,
):
    try:
        # 1. Prepare workspace
        job.status = "cloning"
        _log(job, "status", "Preparing workspace...")
        workspace = await ensure_workspace()
        _log(job, "status", f"Workspace ready at {workspace}")

        # 2. Build prompt
        prompt = _build_prompt(
            issue_number=issue_number,
            issue_title=issue_title,
            issue_body=issue_body,
            implementation_guide=implementation_guide,
            insight_description=insight_description,
            suggested_action=suggested_action,
        )

        # 3. Run Claude agent (code generation only — no git)
        job.status = "running"
        _log(job, "status", "Agent started — implementing issue...")

        options = ClaudeAgentOptions(
            allowed_tools=["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            permission_mode="bypassPermissions",
            max_turns=30,
            model="claude-sonnet-4-5-20250929",
            cwd=workspace,
        )

        full_text = ""

        async for message in query(prompt=prompt, options=options):
            if isinstance(message, StreamEvent):
                event = message.event
                event_type = event.get("type", "")
                if event_type == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        full_text += text
                        _log(job, "agent_text", text)
            elif isinstance(message, AssistantMessage):
                for block in message.content:
                    block_type = getattr(block, "type", None)
                    if block_type == "tool_use":
                        tool_name = getattr(block, "name", "unknown")
                        tool_input = getattr(block, "input", {})
                        summary = str(tool_input)[:200]
                        _log(job, "tool_use", f"Using tool: {tool_name} — {summary}")
                    elif block_type == "text":
                        text = getattr(block, "text", "")
                        full_text += text
                        if text.strip():
                            _log(job, "agent_text", text)

        # 4. Collect changed files from workspace
        _log(job, "status", "Agent finished. Collecting changed files...")
        upserts = await _collect_changed_files(workspace)

        if not upserts:
            job.status = "failed"
            job.error = "Agent made no file changes"
            _log(job, "error", "No file changes detected — nothing to push.")
            return

        _log(job, "status", f"Found {len(upserts)} changed file(s): {', '.join(u['path'] for u in upserts)}")

        # 5. Push to GitHub via Composio (or fallback to raw API)
        job.status = "pushing"
        branch_name = f"ai/issue-{issue_number}"
        commit_message = f"Implement #{issue_number}: {issue_title}"
        pr_title = f"AI: {issue_title}"
        pr_body = f"Closes #{issue_number}\n\nAutomated implementation by Claude Agent.\n\n## Summary\n{full_text[-500:] if len(full_text) > 500 else full_text}"

        if USE_COMPOSIO:
            try:
                await _push_via_composio(job, branch_name, commit_message, pr_title, pr_body, upserts)
                return
            except Exception as e:
                if not GITHUB_PAT:
                    raise RuntimeError(
                        f"Composio failed: {e}. "
                        "Set GITHUB_PAT in .env as a fallback."
                    )
                _log(job, "status", f"Composio failed ({e}), trying GitHub API fallback...")

        if GITHUB_PAT:
            await _push_via_github_api(job, branch_name, commit_message, pr_title, pr_body, upserts)
        else:
            raise RuntimeError(
                "No GitHub credentials available. "
                "Configure Composio GitHub integration or set GITHUB_PAT in .env."
            )

    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        _log(job, "error", f"Build failed: {exc}")


async def _push_via_composio(
    job: BuildJob,
    branch_name: str,
    commit_message: str,
    pr_title: str,
    pr_body: str,
    upserts: list[dict],
):
    """Create branch + commit files atomically, then open PR via Composio."""
    _log(job, "status", f"Creating branch '{branch_name}' and committing {len(upserts)} file(s)...")
    _commit_files_to_branch(branch_name, commit_message, upserts)

    _log(job, "status", "Creating pull request...")
    pr_data = _create_pull_request(branch_name, pr_title, pr_body)

    pr_url = pr_data.get("html_url", f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/pulls")
    job.pr_url = pr_url
    job.status = "completed"
    _log(job, "result", f"Pull request created: {pr_url}")


async def _push_via_github_api(
    job: BuildJob,
    branch_name: str,
    commit_message: str,
    pr_title: str,
    pr_body: str,
    upserts: list[dict],
):
    """Create branch, commit files, and open PR via raw GitHub API."""
    _log(job, "status", "Getting main branch SHA via GitHub API...")
    sha = await _get_main_branch_sha_api()

    _log(job, "status", f"Creating branch '{branch_name}'...")
    await _create_branch_api(branch_name, sha)

    _log(job, "status", f"Committing {len(upserts)} file(s)...")
    await _commit_files_api(branch_name, commit_message, upserts)

    _log(job, "status", "Creating pull request...")
    pr_data = await _create_pull_request_api(branch_name, pr_title, pr_body)

    pr_url = pr_data.get("html_url", f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/pulls")
    job.pr_url = pr_url
    job.status = "completed"
    _log(job, "result", f"Pull request created: {pr_url}")
