export interface MarketAnalysis {
  summary: string;
  key_factors_yes: string[];
  key_factors_no: string[];
  market_implied_probability: number;
  analyst_probability: number;
  reasoning: string;
}

export interface NewsItem {
  title: string;
  snippet: string;
  sentiment: "positive" | "negative" | "neutral";
  relevance_score: number;
}

export interface NewsSummary {
  items: NewsItem[];
  overall_sentiment: string;
  key_insights: string[];
  summary: string;
  news_adjusted_probability: number;
}

export interface DebateArgument {
  position: "YES" | "NO";
  opening_statement: string;
  main_arguments: string[];
  evidence: string[];
  rebuttals: string[];
  probability_estimate: number;
  confidence: number;
}

export interface JudgeVerdict {
  final_probability: number;
  reasoning: string;
  stronger_side: "bullish" | "bearish" | "equal";
  decisive_factors: string[];
  confidence_level: "low" | "medium" | "high";
  market_vs_ai: string;
  recommendation: string;
}

export interface DebateResult {
  run_id: string;
  condition_id: string;
  question: string;
  market_analysis: MarketAnalysis | null;
  news_summary: NewsSummary | null;
  bullish_argument: DebateArgument | null;
  bearish_argument: DebateArgument | null;
  verdict: JudgeVerdict | null;
}

// ─── SSE event types ──────────────────────────────────────────

export type SSEEvent =
  | { event: "run_start"; run_id: string; question: string; condition_id: string }
  | { event: "node_start"; node: string; label: string }
  | { event: "token"; node: string; content: string }
  | { event: "node_complete"; node: string; label: string; data: unknown }
  | { event: "done"; run_id: string; result: DebateResult }
  | { event: "error"; message: string };

export type AgentNode = "market_analysis" | "news_retrieval" | "bullish" | "bearish" | "judge";

export interface AgentStatus {
  status: "idle" | "running" | "complete" | "error";
  label: string;
  streamedText: string;
}
