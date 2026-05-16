"""
All typed schemas for the debate graph.

Three layers:
  1. DebateState    — LangGraph TypedDict (mutable graph state)
  2. Pydantic models — structured LLM outputs (immutable per-node results)
  3. API DTOs        — what the SSE endpoint serializes to the client
"""
import operator
from typing import Annotated, Any, Optional
from pydantic import BaseModel, Field
from typing_extensions import TypedDict


# ─── LLM output schemas ──────────────────────────────────────────────────────

class MarketAnalysis(BaseModel):
    summary: str = Field(description="2-3 sentence summary of the market situation")
    key_factors_yes: list[str] = Field(
        min_length=2, max_length=5,
        description="Top factors that support a YES outcome"
    )
    key_factors_no: list[str] = Field(
        min_length=2, max_length=5,
        description="Top factors that support a NO outcome"
    )
    market_implied_probability: float = Field(
        ge=0, le=1,
        description="What the current market price implies (usually just yes_price)"
    )
    analyst_probability: float = Field(
        ge=0, le=1,
        description="Your initial probability estimate before the debate"
    )
    reasoning: str = Field(description="Step-by-step reasoning behind your estimate")


class NewsItem(BaseModel):
    title: str
    snippet: str
    sentiment: str = Field(description="positive | negative | neutral relative to YES outcome")
    relevance_score: float = Field(ge=0, le=1)


class NewsSummary(BaseModel):
    items: list[NewsItem]
    overall_sentiment: str = Field(description="positive | negative | neutral | mixed")
    key_insights: list[str] = Field(min_length=1, max_length=6)
    summary: str = Field(description="2-3 sentence synthesis of the news landscape")
    news_adjusted_probability: float = Field(
        ge=0, le=1,
        description="Probability estimate adjusted by news context"
    )


class DebateArgument(BaseModel):
    position: str = Field(description="YES or NO")
    opening_statement: str = Field(description="1-2 sentence thesis")
    main_arguments: list[str] = Field(
        min_length=2, max_length=5,
        description="Ordered list of strongest arguments"
    )
    evidence: list[str] = Field(
        description="Specific data points, news, or base rates supporting each argument"
    )
    rebuttals: list[str] = Field(
        description="Direct responses to the opposing side's arguments (empty for bullish, populated for bearish)"
    )
    probability_estimate: float = Field(ge=0, le=1, description="Probability of YES")
    confidence: float = Field(ge=0, le=1)


class JudgeVerdict(BaseModel):
    final_probability: float = Field(
        ge=0, le=1,
        description="Final probability of YES outcome"
    )
    reasoning: str = Field(description="Detailed reasoning for the final estimate")
    stronger_side: str = Field(description="bullish | bearish | equal")
    decisive_factors: list[str] = Field(
        min_length=1, max_length=4,
        description="The factors that most influenced the final verdict"
    )
    confidence_level: str = Field(description="low | medium | high")
    market_vs_ai: str = Field(
        description="Brief comparison: does the AI agree with market price, and by how much"
    )
    recommendation: str = Field(
        description="Actionable summary for a market participant"
    )


# ─── LangGraph state ──────────────────────────────────────────────────────────

class DebateState(TypedDict):
    # ── inputs ──
    condition_id: str
    question: str
    market_context: dict[str, Any]  # serialized MarketRead

    # ── per-node outputs ──
    market_analysis_result: Optional[MarketAnalysis]
    news_summary: Optional[NewsSummary]
    bullish_argument: Optional[DebateArgument]
    bearish_argument: Optional[DebateArgument]
    verdict: Optional[JudgeVerdict]

    # ── observability ──
    run_id: str
    log: Annotated[list[str], operator.add]  # append-only across all nodes


# ─── API DTOs ────────────────────────────────────────────────────────────────

class DebateRequest(BaseModel):
    condition_id: str


class DebateResult(BaseModel):
    run_id: str
    condition_id: str
    question: str
    market_analysis: Optional[MarketAnalysis] = None
    news_summary: Optional[NewsSummary] = None
    bullish_argument: Optional[DebateArgument] = None
    bearish_argument: Optional[DebateArgument] = None
    verdict: Optional[JudgeVerdict] = None
