import httpx
from config import COMPOSIO_API_KEY, GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO
from templates import build_issue_body, build_issue_title

# Try Composio, fall back to raw API
USE_COMPOSIO = bool(COMPOSIO_API_KEY)

if USE_COMPOSIO:
    try:
        from composio import Composio
        composio_client = Composio(api_key=COMPOSIO_API_KEY)
    except Exception:
        USE_COMPOSIO = False
        composio_client = None


async def _create_via_composio(title: str, body: str, labels: list[str]) -> dict:
    result = composio_client.tools.execute(
        action="GITHUB_CREATE_AN_ISSUE",
        params={
            "owner": GITHUB_OWNER,
            "repo": GITHUB_REPO,
            "title": title,
            "body": body,
            "labels": labels,
        },
        user_id="default",
    )
    # Composio wraps response — try common paths for the data
    data = result.get("data", result)
    if isinstance(data, dict):
        return {
            "html_url": data.get("html_url", f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues"),
            "number": data.get("number", 0),
        }
    return {"html_url": f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/issues", "number": 0}


async def _create_via_github_api(title: str, body: str, labels: list[str]) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/issues",
            json={"title": title, "body": body, "labels": labels},
            headers={
                "Authorization": f"token {GITHUB_PAT}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return {"html_url": data["html_url"], "number": data["number"]}


async def create_github_issue(insight: dict, docs: list[dict], implementation_guide: str = "") -> dict:
    title = build_issue_title(insight)
    body = build_issue_body(insight, docs, implementation_guide)
    labels = [insight["category"], insight["severity"]]

    try:
        if USE_COMPOSIO:
            result = await _create_via_composio(title, body, labels)
        else:
            result = await _create_via_github_api(title, body, labels)

        return {
            "insight_id": insight["id"],
            "title": title,
            "github_url": result["html_url"],
            "issue_number": result["number"],
            "status": "created",
            "error": None,
        }
    except Exception as e:
        # If Composio fails, try fallback once
        if USE_COMPOSIO and GITHUB_PAT:
            try:
                result = await _create_via_github_api(title, body, labels)
                return {
                    "insight_id": insight["id"],
                    "title": title,
                    "github_url": result["html_url"],
                    "issue_number": result["number"],
                    "status": "created",
                    "error": None,
                }
            except Exception as fallback_err:
                e = fallback_err

        return {
            "insight_id": insight["id"],
            "title": title,
            "github_url": "",
            "issue_number": 0,
            "status": "failed",
            "error": str(e),
        }


async def create_all_issues(issues: list[dict]) -> list[dict]:
    """Create issues sequentially to preserve order and avoid rate limits."""
    results = []
    for item in issues:
        result = await create_github_issue(item["insight"], item["docs"], item.get("implementation_guide", ""))
        results.append(result)
    return results
