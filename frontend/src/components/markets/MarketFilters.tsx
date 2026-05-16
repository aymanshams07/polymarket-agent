"use client";

import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import type { MarketFilters, SortBy } from "@/types/market";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "volume", label: "Total Volume" },
  { value: "volume_24hr", label: "24h Volume" },
  { value: "liquidity", label: "Liquidity" },
  { value: "end_date", label: "Ending Soon" },
  { value: "price_change", label: "Biggest Movers" },
];

interface Props {
  filters: MarketFilters;
  categories: string[];
  onChange: (patch: Partial<MarketFilters>) => void;
}

export function MarketFilters({ filters, categories, onChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchInput(val);
      // debounce — only trigger query after >=2 chars or empty
      if (val.length === 0 || val.length >= 2) {
        onChange({ search: val });
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search markets..."
          value={searchInput}
          onChange={handleSearch}
          className="sm:max-w-xs text-sm"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => onChange({ sortBy: e.target.value as SortBy })}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <CategoryPill
            label="All"
            active={filters.category === null}
            onClick={() => onChange({ category: null })}
          />
          {categories.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              active={filters.category === cat}
              onClick={() => onChange({ category: cat === filters.category ? null : cat })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      }`}
    >
      {label}
    </button>
  );
}
