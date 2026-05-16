export interface Market {
  id: number;
  condition_id: string;
  poly_id: string | null;
  slug: string | null;
  question: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  event_title: string | null;
  end_date: string | null;
  active: boolean;

  // Prices
  yes_price: number | null;
  no_price: number | null;
  last_trade_price: number | null;
  one_day_price_change: number | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;

  // Volume / liquidity
  volume: number | null;
  volume_24hr: number | null;
  liquidity: number | null;

  created_at: string;
  updated_at: string;
}

export interface MarketList {
  items: Market[];
  total: number;
}

export interface PriceUpdate {
  condition_id: string;
  yes_price: number | null;
  no_price: number | null;
  one_day_price_change: number | null;
  volume_24hr: number | null;
}

export type WSMessage =
  | { type: "snapshot"; markets: Market[]; total: number; timestamp: string }
  | { type: "price_update"; updates: PriceUpdate[]; timestamp: string }
  | { type: "pong" };

export type SortBy = "volume" | "volume_24hr" | "liquidity" | "end_date" | "price_change";
export type SortOrder = "asc" | "desc";

export interface MarketFilters {
  category: string | null;
  search: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
}
