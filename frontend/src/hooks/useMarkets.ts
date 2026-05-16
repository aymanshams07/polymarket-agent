"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Market, MarketFilters, MarketList } from "@/types/market";

function buildUrl(filters: MarketFilters): string {
  const params = new URLSearchParams({ limit: "50", sort_by: filters.sortBy, sort_order: filters.sortOrder });
  if (filters.category) params.set("category", filters.category);
  if (filters.search.trim().length >= 2) params.set("search", filters.search.trim());
  return `/api/v1/markets?${params}`;
}

export function useMarkets(filters: MarketFilters) {
  const key = buildUrl(filters);
  const { data, error, isLoading, mutate } = useSWR<MarketList>(key, fetcher<MarketList>, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });

  function applyPriceUpdates(
    updates: { condition_id: string; yes_price: number | null; no_price: number | null; one_day_price_change: number | null; volume_24hr: number | null }[]
  ) {
    if (!data) return;
    const patch = new Map(updates.map((u) => [u.condition_id, u]));
    mutate(
      {
        ...data,
        items: data.items.map((m): Market => {
          const u = patch.get(m.condition_id);
          return u ? { ...m, ...u } : m;
        }),
      },
      false // don't revalidate — the WS update IS the fresh data
    );
  }

  return { data, error, isLoading, applyPriceUpdates };
}

export function useCategories() {
  const { data } = useSWR<string[]>("/api/v1/markets/categories", fetcher<string[]>, {
    revalidateOnFocus: false,
    dedupingInterval: 120_000,
  });
  return data ?? [];
}
