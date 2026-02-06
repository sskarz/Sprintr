import httpx
import asyncio
from config import YDC_API_KEY

YDC_SEARCH_URL = "https://ydc-index.io/v1/search"


async def search_docs_for_insight(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                YDC_SEARCH_URL,
                params={"query": query, "count": 3},
                headers={"X-API-Key": YDC_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

            results = []
            for item in data.get("results", {}).get("web", [])[:3]:
                snippets = item.get("snippets", [])
                snippet_text = snippets[0] if snippets else item.get("description", "")
                results.append({
                    "url": item.get("url", ""),
                    "title": item.get("title", ""),
                    "snippet": snippet_text[:300],
                })
            return results
        except Exception as e:
            print(f"You.com search failed for '{query}': {e}")
            return []


async def enrich_insights(insights: list[dict]) -> list[dict]:
    from services.gemini_summarizer import summarize_docs_for_insight

    # Step 1: Parallel You.com doc searches
    search_tasks = [search_docs_for_insight(i["doc_search_query"]) for i in insights]
    doc_results = await asyncio.gather(*search_tasks)

    # Step 2: Parallel Gemini summarization of each insight's docs
    summary_tasks = [
        summarize_docs_for_insight(insight, docs)
        for insight, docs in zip(insights, doc_results)
    ]
    summaries = await asyncio.gather(*summary_tasks)

    return [
        {"insight": insight, "docs": docs, "implementation_guide": guide}
        for insight, docs, guide in zip(insights, doc_results, summaries)
    ]
