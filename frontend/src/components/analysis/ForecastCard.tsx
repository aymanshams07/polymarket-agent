"use client";

import type { DebateResult } from "@/types/forecast";

// ─── Helpers ─────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }

function DeltaBadge({ diff }: { diff: number }) {
  const pp = Math.round(Math.abs(diff) * 100);
  const up = diff > 0;
  if (pp < 2) return <span className="text-zinc-400 text-xs">≈ in line with market</span>;
  return (
    <span className={`text-sm font-bold font-mono ${up ? "text-emerald-500" : "text-red-500"}`}>
      {up ? "▲" : "▼"} +{pp}pp {up ? "AI sees upside" : "AI sees downside"}
    </span>
  );
}

const CONFIDENCE_STYLE = {
  low: "border-amber-400 text-amber-400",
  medium: "border-blue-400 text-blue-400",
  high: "border-emerald-400 text-emerald-400",
};

// ─── Main card ───────────────────────────────────────────────

export function ForecastCard({ result }: { result: DebateResult }) {
  const { verdict, bullish_argument, bearish_argument, market_analysis, news_summary } = result;
  if (!verdict) return null;

  const marketProb = market_analysis?.market_implied_probability ?? 0;
  const aiProb = verdict.final_probability;
  const diff = aiProb - marketProb;
  const confStyle = CONFIDENCE_STYLE[verdict.confidence_level as keyof typeof CONFIDENCE_STYLE]
    ?? "border-zinc-400 text-zinc-400";

  return (
    <div className="space-y-4">
      {/* ── Main verdict block ── */}
      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
        {/* Probability comparison header */}
        <div className="bg-zinc-900 px-5 py-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">AI Forecast</p>
              <p className="text-4xl font-bold font-mono text-white">{pct(aiProb)}</p>
              <p className="text-xs text-zinc-400 mt-1">probability YES</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Market</p>
              <p className="text-2xl font-bold font-mono text-zinc-400">{pct(marketProb)}</p>
              <p className="text-xs text-zinc-500 mt-1">current price</p>
            </div>
          </div>

          {/* Probability bars side-by-side */}
          <div className="space-y-2">
            <ProbRow label="AI" value={aiProb} color="bg-blue-500" />
            <ProbRow label="MKT" value={marketProb} color="bg-zinc-600" />
          </div>

          <div className="mt-3 flex items-center gap-3">
            <DeltaBadge diff={diff} />
            <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 uppercase ${confStyle}`}>
              {verdict.confidence_level} conf.
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Mispricing analysis */}
          {Math.abs(diff) >= 0.02 && (
            <div className={`rounded-lg px-3 py-2.5 border-l-2 text-sm ${
              diff > 0 ? "bg-emerald-50 border-emerald-400" : "bg-red-50 border-red-400"
            }`}>
              <p className="font-medium text-zinc-800 mb-0.5">
                {diff > 0 ? "Potential Underpricing Detected" : "Potential Overpricing Detected"}
              </p>
              <p className="text-xs text-zinc-600">{verdict.market_vs_ai}</p>
            </div>
          )}

          {/* Decisive factors */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Decisive Factors
            </p>
            <ul className="space-y-1.5">
              {verdict.decisive_factors.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-700">
                  <span className="text-blue-500 font-bold shrink-0">{i + 1}</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Judge reasoning */}
          <div>
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
              Judge's Reasoning
            </p>
            <p className="text-sm text-zinc-700 leading-relaxed">{verdict.reasoning}</p>
          </div>

          {/* Recommendation */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">
              Recommendation
            </p>
            <p className="text-sm text-zinc-800">{verdict.recommendation}</p>
          </div>
        </div>
      </div>

      {/* ── Debate summary ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {bullish_argument && (
          <ArgumentCard
            side="YES"
            prob={bullish_argument.probability_estimate}
            thesis={bullish_argument.opening_statement}
            points={bullish_argument.main_arguments}
            stronger={verdict.stronger_side === "bullish"}
          />
        )}
        {bearish_argument && (
          <ArgumentCard
            side="NO"
            prob={bearish_argument.probability_estimate}
            thesis={bearish_argument.opening_statement}
            points={bearish_argument.main_arguments}
            stronger={verdict.stronger_side === "bearish"}
          />
        )}
      </div>

      {/* ── News context ── */}
      {news_summary && news_summary.key_insights.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            News Context · {news_summary.overall_sentiment} sentiment
          </p>
          <p className="text-xs text-zinc-500 mb-3">{news_summary.summary}</p>
          <div className="space-y-1.5">
            {news_summary.key_insights.map((insight, i) => (
              <div key={i} className="flex gap-2 text-xs text-zinc-700">
                <span className="text-zinc-400 shrink-0">›</span>
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function ProbRow({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-zinc-500 w-6">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-zinc-300 w-8 text-right">{pct}%</span>
    </div>
  );
}

function ArgumentCard({
  side, prob, thesis, points, stronger,
}: {
  side: "YES" | "NO";
  prob: number;
  thesis: string;
  points: string[];
  stronger: boolean;
}) {
  const isYes = side === "YES";
  return (
    <div className={`rounded-xl border bg-white p-4 ${stronger ? (isYes ? "border-emerald-300" : "border-red-300") : "border-zinc-200"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isYes ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
            {side}
          </span>
          {stronger && (
            <span className="text-[10px] text-zinc-500">STRONGER SIDE</span>
          )}
        </div>
        <span className={`text-sm font-bold font-mono ${isYes ? "text-emerald-600" : "text-red-500"}`}>
          {Math.round(prob * 100)}%
        </span>
      </div>
      <p className="text-xs text-zinc-500 italic mb-2 line-clamp-2">{thesis}</p>
      <ul className="space-y-1">
        {points.map((p, i) => (
          <li key={i} className="flex gap-1.5 text-xs text-zinc-700">
            <span className={`shrink-0 ${isYes ? "text-emerald-500" : "text-red-400"}`}>{i + 1}.</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
