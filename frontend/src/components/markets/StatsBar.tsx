"use client";

import type { Market } from "@/types/market";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center px-4 py-2 border-r last:border-r-0">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface Props {
  markets: Market[];
  total: number;
}

export function StatsBar({ markets, total }: Props) {
  const totalVolume = markets.reduce((s, m) => s + (m.volume ?? 0), 0);
  const volume24h = markets.reduce((s, m) => s + (m.volume_24hr ?? 0), 0);
  const totalLiquidity = markets.reduce((s, m) => s + (m.liquidity ?? 0), 0);

  return (
    <div className="flex items-center rounded-lg border bg-card divide-x overflow-x-auto">
      <Stat label="Active Markets" value={total.toLocaleString()} />
      <Stat label="24h Volume" value={fmt(volume24h)} />
      <Stat label="Total Volume" value={fmt(totalVolume)} />
      <Stat label="Liquidity" value={fmt(totalLiquidity)} />
    </div>
  );
}
