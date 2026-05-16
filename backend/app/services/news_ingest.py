"""
News ingestion pipeline: Tavily → Qdrant

Flow per market:
  1. Build a focused search query from the market question
  2. Fetch articles via Tavily (skip silently if no key)
  3. Upsert into Qdrant with condition_id tag

This is called both:
  - During agent execution (news_retrieval node pulls from Qdrant after ingest)
  - As a background task every N minutes for active markets
"""
from app.services.qdrant_service import qdrant_service, NewsDoc
from agents.tools.news_search import search_news
from app.core.logging import logger


async def ingest_news_for_market(
    condition_id: str,
    question: str,
    max_articles: int = 8,
) -> int:
    """
    Fetch fresh news for a market question and store in Qdrant.
    Returns the number of articles upserted.
    """
    query = _build_query(question)
    raw_results = await search_news(query, max_results=max_articles)

    if not raw_results:
        logger.debug("news_ingest: no results", condition_id=condition_id[:16])
        return 0

    docs = [
        NewsDoc(
            url=r.get("url", ""),
            title=r.get("title", ""),
            content=r.get("content", ""),
            condition_id=condition_id,
            source=_extract_domain(r.get("url", "")),
            published_date=r.get("published_date", ""),
        )
        for r in raw_results
        if r.get("url") and r.get("title")
    ]

    count = await qdrant_service.upsert_articles(docs)
    logger.info(
        "news_ingest: stored articles",
        count=count,
        condition_id=condition_id[:16],
    )
    return count


def _build_query(question: str) -> str:
    """Trim and append temporal context to the search query."""
    q = question.strip().rstrip("?")
    if len(q) > 120:
        q = q[:120]
    return f"{q} 2025 2026 prediction"


def _extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc.removeprefix("www.")
    except Exception:
        return ""
