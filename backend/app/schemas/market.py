from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MarketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    condition_id: str
    poly_id: str | None = None
    slug: str | None = None
    question: str
    description: str | None = None
    category: str | None = None
    image_url: str | None = None
    event_title: str | None = None
    end_date: datetime | None = None
    active: bool = True

    # Prices
    yes_price: float | None = None
    no_price: float | None = None
    last_trade_price: float | None = None
    one_day_price_change: float | None = None
    best_bid: float | None = None
    best_ask: float | None = None
    spread: float | None = None

    # Volume / liquidity
    volume: float | None = None
    volume_24hr: float | None = None
    liquidity: float | None = None

    created_at: datetime
    updated_at: datetime


class MarketList(BaseModel):
    items: list[MarketRead]
    total: int


class PriceUpdate(BaseModel):
    condition_id: str
    yes_price: float | None
    no_price: float | None
    one_day_price_change: float | None
    volume_24hr: float | None
