"""Market Analysis node — objective first-pass assessment of the market."""
from datetime import datetime, timezone
from langchain_core.messages import HumanMessage, SystemMessage
from agents.llm import analysis_llm
from agents.schemas import DebateState, MarketAnalysis
from agents.prompts import MARKET_ANALYSIS_SYSTEM, MARKET_ANALYSIS_HUMAN
from app.core.logging import logger


def _fmt_money(v: float | None) -> str:
    if v is None:
        return "N/A"
    if v >= 1_000_000:
        return f"${v / 1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v / 1_000:.0f}K"
    return f"${v:.0f}"


def _fmt_pct(v: float | None) -> str:
    return f"{v:+.1%}" if v is not None else "N/A"


def _days_remaining(end_date_str: str | None) -> str:
    if not end_date_str:
        return "unknown"
    try:
        end = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
        diff = (end - datetime.now(timezone.utc)).days
        return str(max(0, diff))
    except ValueError:
        return "unknown"


async def market_analysis_node(state: DebateState) -> dict:
    logger.info("market_analysis: starting", run_id=state["run_id"])
    ctx = state["market_context"]

    prompt = MARKET_ANALYSIS_HUMAN.format(
        question=state["question"],
        yes_price=ctx.get("yes_price") or 0.5,
        no_price=ctx.get("no_price") or 0.5,
        volume_24hr=_fmt_money(ctx.get("volume_24hr")),
        volume=_fmt_money(ctx.get("volume")),
        liquidity=_fmt_money(ctx.get("liquidity")),
        price_change=_fmt_pct(ctx.get("one_day_price_change")),
        days_remaining=_days_remaining(ctx.get("end_date")),
        category=ctx.get("category") or "General",
        event_title=ctx.get("event_title") or state["question"],
    )

    llm = analysis_llm().with_structured_output(MarketAnalysis)
    result: MarketAnalysis = await llm.ainvoke([
        SystemMessage(content=MARKET_ANALYSIS_SYSTEM),
        HumanMessage(content=prompt),
    ])

    logger.info(
        "market_analysis: complete",
        run_id=state["run_id"],
        analyst_prob=result.analyst_probability,
    )
    return {
        "market_analysis_result": result,
        "log": [f"market_analysis: analyst_prob={result.analyst_probability:.2f}"],
    }
