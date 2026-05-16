"""Bullish and Bearish debate nodes."""
import json
from langchain_core.messages import HumanMessage, SystemMessage
from agents.llm import debate_llm
from agents.schemas import DebateState, DebateArgument, MarketAnalysis, NewsSummary
from agents.prompts import (
    BULLISH_SYSTEM, BULLISH_HUMAN,
    BEARISH_SYSTEM, BEARISH_HUMAN,
)
from app.core.logging import logger


def _analysis_to_text(analysis: MarketAnalysis | None) -> str:
    if not analysis:
        return "(market analysis unavailable)"
    lines = [
        f"Summary: {analysis.summary}",
        f"Analyst probability: {analysis.analyst_probability:.1%}",
        "Factors supporting YES:",
        *[f"  - {f}" for f in analysis.key_factors_yes],
        "Factors supporting NO:",
        *[f"  - {f}" for f in analysis.key_factors_no],
        f"Reasoning: {analysis.reasoning}",
    ]
    return "\n".join(lines)


def _news_to_text(news: NewsSummary | None) -> str:
    if not news:
        return "(news context unavailable)"
    lines = [
        f"Overall sentiment: {news.overall_sentiment}",
        f"Summary: {news.summary}",
        "Key insights:",
        *[f"  - {i}" for i in news.key_insights],
    ]
    return "\n".join(lines)


def _argument_to_text(arg: DebateArgument | None) -> str:
    if not arg:
        return "(argument unavailable)"
    lines = [
        f"Opening: {arg.opening_statement}",
        f"Probability estimate: {arg.probability_estimate:.1%}",
        "Main arguments:",
        *[f"  {i+1}. {a}" for i, a in enumerate(arg.main_arguments)],
        "Evidence:",
        *[f"  - {e}" for e in arg.evidence],
    ]
    return "\n".join(lines)


async def bullish_node(state: DebateState) -> dict:
    logger.info("bullish: starting", run_id=state["run_id"])
    ctx = state["market_context"]

    prompt = BULLISH_HUMAN.format(
        question=state["question"],
        market_analysis=_analysis_to_text(state.get("market_analysis_result")),
        news_summary=_news_to_text(state.get("news_summary")),
        yes_price=ctx.get("yes_price") or 0.5,
    )

    llm = debate_llm().with_structured_output(DebateArgument)
    result: DebateArgument = await llm.ainvoke([
        SystemMessage(content=BULLISH_SYSTEM),
        HumanMessage(content=prompt),
    ])

    logger.info(
        "bullish: complete",
        run_id=state["run_id"],
        prob=result.probability_estimate,
        confidence=result.confidence,
    )
    return {
        "bullish_argument": result,
        "log": [f"bullish: prob={result.probability_estimate:.2f} confidence={result.confidence:.2f}"],
    }


async def bearish_node(state: DebateState) -> dict:
    logger.info("bearish: starting", run_id=state["run_id"])
    ctx = state["market_context"]

    prompt = BEARISH_HUMAN.format(
        question=state["question"],
        market_analysis=_analysis_to_text(state.get("market_analysis_result")),
        news_summary=_news_to_text(state.get("news_summary")),
        yes_price=ctx.get("yes_price") or 0.5,
        bullish_argument=_argument_to_text(state.get("bullish_argument")),
    )

    llm = debate_llm().with_structured_output(DebateArgument)
    result: DebateArgument = await llm.ainvoke([
        SystemMessage(content=BEARISH_SYSTEM),
        HumanMessage(content=prompt),
    ])

    logger.info(
        "bearish: complete",
        run_id=state["run_id"],
        prob=result.probability_estimate,
        confidence=result.confidence,
    )
    return {
        "bearish_argument": result,
        "log": [f"bearish: prob={result.probability_estimate:.2f} confidence={result.confidence:.2f}"],
    }
