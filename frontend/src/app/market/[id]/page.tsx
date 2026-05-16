"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/layout/Nav";
import { AgentTimeline } from "@/components/analysis/AgentTimeline";
import { ForecastCard } from "@/components/analysis/ForecastCard";
import { useDebateStream } from "@/hooks/useDebateStream";
import { fetcher } from "@/lib/api";
import type { Market } from "@/types/market";

// ─── Market header (ticker-style) ────────────────────────────

function MarketHeader({ market }: { market: Market }) {
  const yes = market.yes_price ?? 0.5;
  const yesPct = Math.round(yes * 100);
  const change = market.one_day_price_change;

  function fmt(n: number | null) {
    if (!n) return "—";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <div className="bg-white border-b border-zinc-200 px-4 py-4">
      <div className="max-w-screen-xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-zinc-400 mb-2">
          <Link href="/" className="hover:text-zinc-600">Markets</Link>
          <span>/</span>
          {market.category && <><span>{market.category}</span><span>/</span></>}
          <span className="text-zinc-600 truncate max-w-xs">{market.question.slice(0, 60)}…</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            {market.image_url && (
              <img src={market.image_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5" />
            )}
            <div>
              <h1 className="text-base font-bold text-zinc-900 leading-snug max-w-2xl">
                {market.question}
              </h1>
              {market.event_title && market.event_title !== market.question && (
                <p className="text-xs text-zinc-400 mt-0.5">{market.event_title}</p>
              )}
            </div>
          </div>

          {/* Ticker bar */}
          <div className="flex items-center gap-6 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2 shrink-0">
            <TickerStat label="YES" value={`${yesPct}%`} highlight="emerald" />
            <TickerStat label="NO" value={`${100 - yesPct}%`} highlight="red" />
            {change != null && (
              <TickerStat
                label="24h"
                value={`${change >= 0 ? "+" : ""}${(change * 100).toFixed(1)}%`}
                highlight={change >= 0 ? "emerald" : "red"}
              />
            )}
            {market.volume_24hr != null && (
              <TickerStat label="VOL" value={fmt(market.volume_24hr)} highlight="zinc" />
            )}
            {market.end_date && (
              <TickerStat label="ENDS" value={daysLabel(market.end_date)} highlight="zinc" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TickerStat({
  label, value, highlight,
}: { label: string; value: string; highlight: "emerald" | "red" | "zinc" }) {
  const colors = {
    emerald: "text-emerald-600",
    red: "text-red-500",
    zinc: "text-zinc-700",
  };
  return (
    <div className="text-center min-w-[40px]">
      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-widest">{label}</p>
      <p className={`text-sm font-bold font-mono ${colors[highlight]}`}>{value}</p>
    </div>
  );
}

function daysLabel(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return "Ended";
  if (d === 0) return "Today";
  return `${d}d`;
}

// ─── Analysis trigger button ──────────────────────────────────

function RunButton({
  phase, onStart, onReset,
}: {
  phase: string;
  onStart: () => void;
  onReset: () => void;
}) {
  if (phase === "idle") {
    return (
      <button
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white rounded-lg py-3 text-sm font-semibold hover:bg-zinc-700 transition-colors"
      >
        <span>▶</span> Run AI Analysis
      </button>
    );
  }

  if (phase === "running") {
    return (
      <div className="w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg py-3 text-sm font-semibold">
        <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Agents running…
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 border border-zinc-300 text-zinc-600 rounded-lg py-2.5 text-sm hover:bg-zinc-50 transition-colors"
      >
        ↺ Run Again
      </button>
    );
  }

  if (phase === "error") {
    return (
      <button
        onClick={onReset}
        className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-200 text-red-600 rounded-lg py-2.5 text-sm hover:bg-red-100 transition-colors"
      >
        ↺ Retry
      </button>
    );
  }

  return null;
}

// ─── Page ─────────────────────────────────────────────────────

interface Props {
  params: Promise<{ id: string }>;
}

export default function MarketPage({ params }: Props) {
  const { id } = use(params);
  const [market, setMarket] = useState<Market | null>(null);
  const [loadError, setLoadError] = useState(false);

  const { phase, agents, result, error, start, reset, nodes } = useDebateStream(id);

  useEffect(() => {
    fetcher<Market>(`/api/v1/markets/${id}`)
      .then(setMarket)
      .catch(() => setLoadError(true));
  }, [id]);

  if (loadError) {
    return (
      <>
        <Nav />
        <div className="max-w-screen-xl mx-auto px-4 py-12 text-center text-zinc-500">
          Market not found.{" "}
          <Link href="/" className="underline text-zinc-700">Back to markets</Link>
        </div>
      </>
    );
  }

  if (!market) {
    return (
      <>
        <Nav />
        <div className="max-w-screen-xl mx-auto px-4 py-4 animate-pulse space-y-4">
          <div className="h-20 bg-zinc-200 rounded-xl" />
          <div className="h-64 bg-zinc-200 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <Nav />
      <MarketHeader market={market} />

      <div className="max-w-screen-xl mx-auto px-4 py-6">
        {/* Two-column layout: left = actions + results, right = agent timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left column (60%) ── */}
          <div className="lg:col-span-3 space-y-4">
            <RunButton phase={phase} onStart={start} onReset={reset} />

            {phase === "error" && error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {phase === "complete" && result && <ForecastCard result={result} />}

            {phase === "idle" && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center space-y-2">
                <p className="text-2xl font-bold font-mono text-zinc-900">
                  {Math.round((market.yes_price ?? 0.5) * 100)}%
                </p>
                <p className="text-xs text-zinc-400">current market probability (YES)</p>
                <p className="text-sm text-zinc-500 mt-3 max-w-xs mx-auto">
                  Run AI analysis to see how 5 agents debate this market and where they disagree with current odds.
                </p>
              </div>
            )}
          </div>

          {/* ── Right column (40%) — Agent Timeline ── */}
          <div className="lg:col-span-2">
            <AgentTimeline nodes={nodes} agents={agents} phase={phase} />
          </div>
        </div>
      </div>
    </>
  );
}
