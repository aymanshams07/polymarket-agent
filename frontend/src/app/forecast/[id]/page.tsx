"use client";

import { use } from "react";
import Link from "next/link";
import { AgentCard } from "@/components/forecast/AgentCard";
import { VerdictPanel } from "@/components/forecast/VerdictPanel";
import { useDebateStream } from "@/hooks/useDebateStream";
import type { AgentNode } from "@/types/forecast";

const NODE_ORDER: AgentNode[] = [
  "market_analysis",
  "news_retrieval",
  "bullish",
  "bearish",
  "judge",
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function ForecastPage({ params }: Props) {
  const { id } = use(params);
  const { phase, agents, result, error, start, reset, runId } = useDebateStream(id);

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Markets
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">AI Debate Forecast</h1>
            <p className="text-xs text-muted-foreground font-mono truncate">{id}</p>
          </div>
          {runId && (
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:block">
              run/{runId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Launch button */}
        {phase === "idle" && (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">
              Run a 5-agent AI debate to forecast this market.
            </p>
            <button
              onClick={start}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Debate
            </button>
          </div>
        )}

        {/* Running / complete state */}
        {(phase === "running" || phase === "complete") && (
          <>
            {/* Agent pipeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Agent Pipeline
                </h2>
                {phase === "complete" && (
                  <button
                    onClick={reset}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Run again
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {NODE_ORDER.map((node) => (
                  <AgentCard key={node} node={node} status={agents[node]} />
                ))}
              </div>
            </div>

            {/* Verdict */}
            {phase === "complete" && result && (
              <div className="space-y-3">
                <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Forecast Results
                </h2>
                <VerdictPanel result={result} />
              </div>
            )}
          </>
        )}

        {/* Error state */}
        {phase === "error" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-3">
            <p className="font-medium text-destructive">Debate failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={reset}
              className="text-sm text-primary underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
