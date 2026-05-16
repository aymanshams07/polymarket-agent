"use client";

import { useCallback, useRef, useState } from "react";
import { MarketCard } from "./MarketCard";
import { MarketFilters } from "./MarketFilters";
import { StatsBar } from "./StatsBar";
import { LiveBadge } from "./LiveBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarkets, useCategories } from "@/hooks/useMarkets";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import type { MarketFilters as Filters, WSMessage } from "@/types/market";

const DEFAULT_FILTERS: Filters = {
  category: null,
  search: "",
  sortBy: "volume",
  sortOrder: "desc",
};

// ─── Loading skeleton ────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full mt-3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────

export function MarketGrid() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const categories = useCategories();
  const { data, error, isLoading, applyPriceUpdates } = useMarkets(filters);

  // Track which condition_ids received a WS update for flash animation
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handlePriceUpdate = useCallback(
    (msg: Extract<WSMessage, { type: "price_update" }>) => {
      applyPriceUpdates(msg.updates);
      const ids = msg.updates.map((u) => u.condition_id);
      setUpdatedIds((prev) => new Set([...prev, ...ids]));
      ids.forEach((id) => {
        const prev = updateTimers.current.get(id);
        if (prev) clearTimeout(prev);
        updateTimers.current.set(
          id,
          setTimeout(() => {
            setUpdatedIds((s) => {
              const next = new Set(s);
              next.delete(id);
              return next;
            });
          }, 2000)
        );
      });
    },
    [applyPriceUpdates]
  );

  const wsStatus = useMarketSocket({ onPriceUpdate: handlePriceUpdate });

  function patchFilters(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  return (
    <div className="space-y-5">
      {/* Stats + live indicator */}
      {data && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <StatsBar markets={data.items} total={data.total} />
          </div>
          <LiveBadge status={wsStatus} />
        </div>
      )}

      {/* Filters */}
      <MarketFilters filters={filters} categories={categories} onChange={patchFilters} />

      {/* Grid content */}
      {isLoading && <GridSkeleton />}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load markets. Make sure the backend is running at{" "}
          <code className="text-xs bg-muted px-1 rounded">
            {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
          </code>
        </div>
      )}

      {!isLoading && !error && data?.items.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          {filters.search || filters.category
            ? "No markets match your filters."
            : "No markets yet — the backend is syncing from Polymarket."}
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map((market) => (
              <MarketCard
                key={market.condition_id}
                market={market}
                isUpdated={updatedIds.has(market.condition_id)}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Showing {data.items.length} of {data.total} markets · Updates every 30s
          </p>
        </>
      )}
    </div>
  );
}
