"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DebateResult } from "@/types/forecast";

function ProbBar({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className={color}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            pct >= 50 ? "bg-green-500" : "bg-red-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface Props {
  result: DebateResult;
}

const CONFIDENCE_COLORS = {
  low: "bg-yellow-100 text-yellow-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-green-100 text-green-700",
};

export function VerdictPanel({ result }: Props) {
  const { verdict, bullish_argument, bearish_argument, market_analysis, news_summary } =
    result;

  if (!verdict) return null;

  const marketPrice = market_analysis?.market_implied_probability ?? 0.5;
  const diff = verdict.final_probability - marketPrice;

  return (
    <div className="space-y-4">
      {/* Verdict header */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-base">Judge&apos;s Verdict</CardTitle>
            <Badge
              className={
                CONFIDENCE_COLORS[verdict.confidence_level] ?? "bg-muted text-muted-foreground"
              }
            >
              {verdict.confidence_level} confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Probabilities */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ProbBar
              value={verdict.final_probability}
              label="AI Estimate (YES)"
              color={verdict.final_probability >= 0.5 ? "text-green-600" : "text-red-500"}
            />
            <ProbBar
              value={marketPrice}
              label="Market Price (YES)"
              color="text-muted-foreground"
            />
          </div>

          {/* Market vs AI delta */}
          <div
            className={`text-xs rounded px-2 py-1.5 ${
              Math.abs(diff) > 0.1
                ? "bg-amber-50 text-amber-700"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {verdict.market_vs_ai}
          </div>

          {/* Reasoning */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Reasoning</p>
            <p className="text-sm leading-relaxed">{verdict.reasoning}</p>
          </div>

          {/* Decisive factors */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Decisive Factors</p>
            <ul className="space-y-1">
              {verdict.decisive_factors.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary shrink-0">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendation */}
          <div className="bg-primary/5 rounded p-3">
            <p className="text-xs font-medium text-primary mb-0.5">Recommendation</p>
            <p className="text-sm">{verdict.recommendation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Debate summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bullish_argument && (
          <ArgumentSummary arg={bullish_argument} side="bullish" />
        )}
        {bearish_argument && (
          <ArgumentSummary arg={bearish_argument} side="bearish" />
        )}
      </div>

      {/* News insights */}
      {news_summary && news_summary.key_insights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">News Context</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">{news_summary.summary}</p>
            <ul className="space-y-1">
              {news_summary.key_insights.map((insight, i) => (
                <li key={i} className="text-xs flex gap-1.5">
                  <span className="text-muted-foreground shrink-0">›</span>
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ArgumentSummary({
  arg,
  side,
}: {
  arg: { position: string; opening_statement: string; main_arguments: string[]; probability_estimate: number; confidence: number };
  side: "bullish" | "bearish";
}) {
  const isBullish = side === "bullish";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">
            {isBullish ? "YES Case" : "NO Case"}
          </CardTitle>
          <span
            className={`text-xs font-semibold ${
              isBullish ? "text-green-600" : "text-red-500"
            }`}
          >
            {Math.round(arg.probability_estimate * 100)}% YES
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground italic">{arg.opening_statement}</p>
        <ul className="space-y-1">
          {arg.main_arguments.map((a, i) => (
            <li key={i} className="text-xs flex gap-1.5">
              <span className={isBullish ? "text-green-500" : "text-red-400"}>
                {i + 1}.
              </span>
              {a}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
