"""Market service: syncs Polymarket API data into Postgres, serves queries."""
from datetime import datetime
from typing import Any
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import AsyncSessionLocal
from app.db.models import Market
from app.schemas.market import MarketRead, MarketList
from app.services.polymarket_client import polymarket_client, parse_outcome_prices
from app.core.logging import logger

# ─── Category classifier ─────────────────────────────────────────────────────

_CATEGORIES: list[tuple[str, list[str]]] = [
    ("Crypto", ["bitcoin", "ethereum", "btc", "eth", "crypto", "defi", "nft", "solana", "xrp", "blockchain"]),
    ("Politics", ["president", "election", "senate", "congress", "trump", "biden", "democrat", "republican", "vote", "poll", "governor", "prime minister", "parliament"]),
    ("Sports", ["nfl", "nba", "mlb", "nhl", "soccer", "football", "basketball", "baseball", "championship", "super bowl", "world cup", "olympics", "tennis", "golf", "ufc", "mma", "formula 1", "f1"]),
    ("Finance", ["s&p", "spy", "stock", "gdp", "inflation", "federal reserve", "interest rate", "nasdaq", "dow jones", "earnings", "ipo", "recession", "mortgage", "treasury"]),
    ("Science & Tech", ["openai", "gpt", "artificial intelligence", " ai ", "spacex", "nasa", "climate", "temperature", "drug", "fda", "vaccine"]),
]


def classify_market(question: str, description: str | None = None) -> str:
    text_lower = (question + " " + (description or "")).lower()
    for category, keywords in _CATEGORIES:
        if any(kw in text_lower for kw in keywords):
            return category
    return "Other"


# ─── Row transformation ───────────────────────────────────────────────────────

def _api_to_row(raw: dict[str, Any]) -> dict[str, Any]:
    yes_price, no_price = parse_outcome_prices(raw.get("outcomePrices", "[]"))
    question = raw.get("question", "")
    description = raw.get("description")

    end_date: datetime | None = None
    if raw_end := raw.get("endDate"):
        try:
            end_date = datetime.fromisoformat(raw_end.replace("Z", "+00:00"))
        except ValueError:
            pass

    return {
        "condition_id": raw.get("conditionId", ""),
        "poly_id": str(raw.get("id", "")),
        "slug": raw.get("slug", ""),
        "question": question,
        "description": description,
        "category": classify_market(question, description),
        "image_url": raw.get("image"),
        "end_date": end_date,
        "yes_price": yes_price,
        "no_price": no_price,
        "last_trade_price": raw.get("lastTradePrice"),
        "one_day_price_change": raw.get("oneDayPriceChange"),
        "best_bid": raw.get("bestBid"),
        "best_ask": raw.get("bestAsk"),
        "spread": raw.get("spread"),
        "volume": raw.get("volumeNum") or _safe_float(raw.get("volume")),
        "volume_24hr": raw.get("volume24hr"),
        "liquidity": raw.get("liquidityNum") or _safe_float(raw.get("liquidity")),
        "active": bool(raw.get("active", True)),
        "event_title": raw.get("events", [{}])[0].get("title") if raw.get("events") else None,
    }


def _safe_float(v: Any) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


# ─── Service ──────────────────────────────────────────────────────────────────

class MarketService:
    async def sync_markets(self, limit: int = 100) -> list[MarketRead]:
        """Fetch from Polymarket API, upsert to DB, return updated rows."""
        raw_markets = await polymarket_client.fetch_top_markets(n=limit)
        if not raw_markets:
            logger.warning("sync_markets: no data returned from Polymarket API")
            return []

        rows = [_api_to_row(m) for m in raw_markets if m.get("conditionId")]

        async with AsyncSessionLocal() as db:
            for row in rows:
                stmt = (
                    insert(Market)
                    .values(**row)
                    .on_conflict_do_update(
                        index_elements=["condition_id"],
                        set_={
                            k: getattr(insert(Market).excluded, k)
                            for k in row
                            if k != "condition_id"
                        },
                    )
                )
                await db.execute(stmt)
            await db.commit()

        logger.info("sync_markets: upserted markets", count=len(rows))
        return await self.list_markets()

    async def list_markets(
        self,
        limit: int = 50,
        offset: int = 0,
        category: str | None = None,
        search: str | None = None,
        sort_by: str = "volume",
        sort_order: str = "desc",
    ) -> MarketList:
        sort_col_map = {
            "volume": Market.volume,
            "volume_24hr": Market.volume_24hr,
            "liquidity": Market.liquidity,
            "end_date": Market.end_date,
            "price_change": Market.one_day_price_change,
        }
        order_col = sort_col_map.get(sort_by, Market.volume)

        async with AsyncSessionLocal() as db:
            q = select(Market).where(Market.active == True)  # noqa: E712
            if category:
                q = q.where(Market.category == category)
            if search:
                q = q.where(Market.question.ilike(f"%{search}%"))

            total_res = await db.execute(select(func.count()).select_from(q.subquery()))
            total = total_res.scalar_one()

            if sort_order == "asc":
                q = q.order_by(order_col.asc().nulls_last())
            else:
                q = q.order_by(order_col.desc().nulls_last())

            result = await db.execute(q.offset(offset).limit(limit))
            items = result.scalars().all()

        return MarketList(
            items=[MarketRead.model_validate(m) for m in items],
            total=total,
        )

    async def get_market(self, condition_id: str) -> MarketRead | None:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Market).where(Market.condition_id == condition_id)
            )
            row = result.scalar_one_or_none()
        return MarketRead.model_validate(row) if row else None

    async def get_categories(self) -> list[str]:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Market.category)
                .where(Market.active == True)  # noqa: E712
                .where(Market.category.isnot(None))
                .distinct()
                .order_by(Market.category)
            )
            return [r for (r,) in result.all() if r]


market_service = MarketService()
