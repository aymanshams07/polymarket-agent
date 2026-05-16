"""News search tool — Tavily if configured, silent no-op otherwise."""
import httpx
from app.core.config import settings
from app.core.logging import logger


async def search_news(query: str, max_results: int = 6) -> list[dict]:
    """
    Search for relevant news via Tavily API.
    Returns [] if TAVILY_API_KEY is not configured — callers handle the empty case.
    """
    if not settings.tavily_api_key:
        logger.debug("News search skipped: TAVILY_API_KEY not configured")
        return []

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "search_depth": "basic",
                    "topic": "news",
                    "max_results": max_results,
                    "include_answer": False,
                    "include_raw_content": False,
                },
            )
            resp.raise_for_status()
            results = resp.json().get("results", [])
            logger.info("News search completed", query=query[:60], count=len(results))
            return [
                {
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "content": r.get("content", "")[:400],
                    "published_date": r.get("published_date", ""),
                    "score": r.get("score", 0),
                }
                for r in results
            ]
    except Exception as exc:
        logger.warning("News search failed", error=str(exc))
        return []


def format_results_for_prompt(results: list[dict]) -> str:
    if not results:
        return "(no search results available)"
    lines = []
    for i, r in enumerate(results, 1):
        lines.append(
            f"{i}. **{r['title']}** ({r.get('published_date', 'unknown date')})\n"
            f"   {r['content']}"
        )
    return "\n\n".join(lines)
