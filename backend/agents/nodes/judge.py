"""Judge node — impartial verdict synthesizing both sides of the debate."""
from langchain_core.messages import HumanMessage, SystemMessage
from agents.llm import judge_llm
from agents.schemas import DebateState, JudgeVerdict
from agents.prompts import JUDGE_SYSTEM, JUDGE_HUMAN
from agents.nodes.debate import _analysis_to_text, _news_to_text, _argument_to_text
from app.core.logging import logger


async def judge_node(state: DebateState) -> dict:
    logger.info("judge: starting", run_id=state["run_id"])
    ctx = state["market_context"]

    bullish = state.get("bullish_argument")
    bearish = state.get("bearish_argument")

    prompt = JUDGE_HUMAN.format(
        question=state["question"],
        market_analysis=_analysis_to_text(state.get("market_analysis_result")),
        news_summary=_news_to_text(state.get("news_summary")),
        bullish_prob=bullish.probability_estimate if bullish else 0.5,
        bullish_argument=_argument_to_text(bullish),
        bearish_prob=bearish.probability_estimate if bearish else 0.5,
        bearish_argument=_argument_to_text(bearish),
        market_price=ctx.get("yes_price") or 0.5,
    )

    llm = judge_llm().with_structured_output(JudgeVerdict)
    result: JudgeVerdict = await llm.ainvoke([
        SystemMessage(content=JUDGE_SYSTEM),
        HumanMessage(content=prompt),
    ])

    logger.info(
        "judge: verdict",
        run_id=state["run_id"],
        final_prob=result.final_probability,
        stronger_side=result.stronger_side,
        confidence=result.confidence_level,
        market_price=ctx.get("yes_price"),
    )
    return {
        "verdict": result,
        "log": [
            f"judge: final_prob={result.final_probability:.2f} "
            f"stronger={result.stronger_side} "
            f"confidence={result.confidence_level}"
        ],
    }
