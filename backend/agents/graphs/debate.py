"""
Debate graph assembly.

Flow:
  START → market_analysis → news_retrieval → bullish → bearish → judge → END

Each node is a pure async function. The graph is compiled once at import time
and reused across requests (thread-safe, stateless compilation).
"""
import uuid
from typing import Any
from langgraph.graph import StateGraph, START, END
from agents.schemas import DebateState, DebateResult
from agents.nodes.market_analysis import market_analysis_node
from agents.nodes.news_retrieval import news_retrieval_node
from agents.nodes.debate import bullish_node, bearish_node
from agents.nodes.judge import judge_node
from app.core.logging import logger

# ─── Graph definition ─────────────────────────────────────────────────────────

def _build_graph():
    builder = StateGraph(DebateState)

    builder.add_node("market_analysis", market_analysis_node)
    builder.add_node("news_retrieval", news_retrieval_node)
    builder.add_node("bullish", bullish_node)
    builder.add_node("bearish", bearish_node)
    builder.add_node("judge", judge_node)

    builder.add_edge(START, "market_analysis")
    builder.add_edge("market_analysis", "news_retrieval")
    builder.add_edge("news_retrieval", "bullish")
    builder.add_edge("bullish", "bearish")
    builder.add_edge("bearish", "judge")
    builder.add_edge("judge", END)

    return builder.compile()


debate_graph = _build_graph()

# ─── Node display names (for SSE events) ─────────────────────────────────────

NODE_LABELS: dict[str, str] = {
    "market_analysis": "Market Analysis",
    "news_retrieval": "News Retrieval",
    "bullish": "Bullish Argument",
    "bearish": "Bearish Rebuttal",
    "judge": "Judge Verdict",
}

# ─── Run helpers ─────────────────────────────────────────────────────────────

def make_initial_state(
    condition_id: str,
    question: str,
    market_context: dict[str, Any],
) -> DebateState:
    return DebateState(
        condition_id=condition_id,
        question=question,
        market_context=market_context,
        market_analysis_result=None,
        news_summary=None,
        bullish_argument=None,
        bearish_argument=None,
        verdict=None,
        run_id=str(uuid.uuid4()),
        log=[],
    )


async def run_debate(
    condition_id: str,
    question: str,
    market_context: dict[str, Any],
) -> DebateResult:
    """Run the full graph to completion and return a structured result."""
    state = make_initial_state(condition_id, question, market_context)
    logger.info("debate: starting", run_id=state["run_id"], question=question[:80])

    final_state: DebateState = await debate_graph.ainvoke(state)

    logger.info(
        "debate: complete",
        run_id=state["run_id"],
        log=final_state.get("log", []),
    )
    return DebateResult(
        run_id=final_state["run_id"],
        condition_id=condition_id,
        question=question,
        market_analysis=final_state.get("market_analysis_result"),
        news_summary=final_state.get("news_summary"),
        bullish_argument=final_state.get("bullish_argument"),
        bearish_argument=final_state.get("bearish_argument"),
        verdict=final_state.get("verdict"),
    )
