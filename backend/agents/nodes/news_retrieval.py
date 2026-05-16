"""
News Retrieval node — RAG-enhanced.

Pipeline:
  1. Ingest fresh Tavily articles into Qdrant (if API key configured)
  2. Semantic search Qdrant for the most relevant stored articles
  3. Pass retrieved context to Claude for synthesis

Falls back gracefully when neither Tavily nor Qdrant has data.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from agents.llm import analysis_llm
from agents.schemas import DebateState, NewsSummary
from agents.prompts import (
    NEWS_RETRIEVAL_SYSTEM,
    NEWS_RETRIEVAL_HUMAN_WITH_RESULTS,
    NEWS_RETRIEVAL_HUMAN_NO_RESULTS,
)
from app.core.logging import logger


def _format_rag_results(results) -> str:
    if not results:
        return "(no search results available)"
    lines = []
    for i, r in enumerate(results, 1):
        score_pct = f"{r.score:.0%}" if hasattr(r, "score") else ""
        lines.append(
            f"{i}. **{r.title}** [relevance: {score_pct}]\n"
            f"   Source: {r.url}\n"
            f"   {r.content[:350]}"
        )
    return "\n\n".join(lines)


async def news_retrieval_node(state: DebateState) -> dict:
    logger.info("news_retrieval: starting", run_id=state["run_id"])

    condition_id = state["condition_id"]
    question = state["question"]
    rag_results = []

    # ── Step 1: ingest fresh news into Qdrant ───────────────────
    try:
        from app.services.news_ingest import ingest_news_for_market
        ingested = await ingest_news_for_market(condition_id, question)
        logger.info("news_retrieval: ingested", count=ingested, run_id=state["run_id"])
    except Exception as exc:
        logger.warning("news_retrieval: ingest failed", error=str(exc))

    # ── Step 2: semantic search Qdrant ──────────────────────────
    try:
        from app.services.qdrant_service import qdrant_service
        rag_results = await qdrant_service.search(
            query=question,
            condition_id=condition_id,
            limit=6,
        )
        # If no market-specific results, search globally
        if not rag_results:
            rag_results = await qdrant_service.search(query=question, limit=6)
    except Exception as exc:
        logger.warning("news_retrieval: qdrant search failed", error=str(exc))

    # ── Step 3: synthesize with LLM ─────────────────────────────
    has_results = bool(rag_results)

    if has_results:
        prompt = NEWS_RETRIEVAL_HUMAN_WITH_RESULTS.format(
            question=question,
            search_results=_format_rag_results(rag_results),
        )
    else:
        prompt = NEWS_RETRIEVAL_HUMAN_NO_RESULTS.format(question=question)

    llm = analysis_llm().with_structured_output(NewsSummary)
    result: NewsSummary = await llm.ainvoke([
        SystemMessage(content=NEWS_RETRIEVAL_SYSTEM),
        HumanMessage(content=prompt),
    ])

    logger.info(
        "news_retrieval: complete",
        run_id=state["run_id"],
        items=len(result.items),
        sentiment=result.overall_sentiment,
        rag_hits=len(rag_results),
    )
    return {
        "news_summary": result,
        "log": [
            f"news_retrieval: rag_hits={len(rag_results)} "
            f"items={len(result.items)} "
            f"sentiment={result.overall_sentiment}"
        ],
    }
