"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Market } from "@/types/market";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function daysUntil(isoDate: string): string {
  const d = Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
  if (d < 0) return "Ended";
  if (d === 0) return "Today";
  if (d === 1) return "1d";
  if (d < 30) return `${d}d`;
  return `${Math.round(d / 30)}mo`;
}

function Trend({ change }: { change: number }) {
  const up = change >= 0;
  return (
    <span className={`font-mono text-[11px] ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(change * 100).toFixed(1)}%
    </span>
  );
}

interface Props {
  market: Market;
  isUpdated?: boolean;
}

export function MarketCard({ market, isUpdated = false }: Props) {
  const [flash, setFlash] = useState(false);
  const prevYes = useRef(market.yes_price);

  useEffect(() => {
    if (isUpdated && market.yes_price !== prevYes.current) {
      setFlash(true);
      prevYes.current = market.yes_price;
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [market.yes_price, isUpdated]);

  const yes = market.yes_price ?? 0.5;
  const yesPct = Math.round(yes * 100);

  return (
    <Link
      href={`/market/${market.condition_id}`}
      className={`group block rounded-lg border bg-white p-4 transition-all
        hover:border-zinc-400 hover:shadow-sm
        ${flash ? "border-amber-300 bg-amber-50" : "border-zinc-200"}`}
    >
      {/* Top row */}
      <div className="flex items-start gap-2 mb-3">
        {market.image_url && (
          <img
            src={market.image_url}
            alt=""
            className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
          />
        )}
        <div className="flex-1 min-w-0">
          {market.category && (
            <span className="inline-block text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
              {market.category}
            </span>
          )}
          <p className="text-sm font-medium text-zinc-900 leading-snug line-clamp-2">
            {market.question}
          </p>
        </div>
      </div>

      {/* Probability bar */}
      {market.yes_price != null && (
        <div className="mb-2">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-mono font-semibold text-emerald-600">{yesPct}% YES</span>
            <span className="text-xs font-mono text-zinc-400">{100 - yesPct}% NO</span>
          </div>
          <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${yesPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {market.volume_24hr != null && market.volume_24hr > 0 && (
            <span className="text-[11px] font-mono text-zinc-400">{fmt(market.volume_24hr)}</span>
          )}
          {market.one_day_price_change != null && (
            <Trend change={market.one_day_price_change} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {market.end_date && (
            <span className="text-[11px] text-zinc-400">{daysUntil(market.end_date)}</span>
          )}
          <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors">
            Analyze →
          </span>
        </div>
      </div>
    </Link>
  );
}
