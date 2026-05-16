"""
Background tasks:
  1. market_poller  — syncs Polymarket prices every 30s, broadcasts WS diffs
  2. news_ingester  — ingests news for top markets every 15 minutes
"""
import asyncio
from datetime import datetime, timezone
from app.core.logging import logger
from app.core.ws_manager import ws_manager
from app.services.market_service import market_service

MARKET_POLL_INTERVAL = 30    # seconds
NEWS_INGEST_INTERVAL = 900   # 15 minutes
NEWS_TOP_N_MARKETS = 20      # ingest news for the top N markets by volume


# ─── Market price poller ──────────────────────────────────────────────────────

async def _poll_prices(prev_prices: dict[str, tuple]) -> None:
    markets = await market_service.sync_markets(limit=100)

    updates = []
    for m in markets.items:
        old = prev_prices.get(m.condition_id)
        if old != (m.yes_price, m.no_price):
            prev_prices[m.condition_id] = (m.yes_price, m.no_price)
            if old is not None:
                updates.append({
                    "condition_id": m.condition_id,
                    "yes_price": m.yes_price,
                    "no_price": m.no_price,
                    "one_day_price_change": m.one_day_price_change,
                    "volume_24hr": m.volume_24hr,
                })

    if updates:
        await ws_manager.broadcast({
            "type": "price_update",
            "updates": updates,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Broadcast price updates", count=len(updates))


async def market_poller() -> None:
    prev_prices: dict[str, tuple] = {}
    logger.info("Market poller started", interval=MARKET_POLL_INTERVAL)

    try:
        markets = await market_service.sync_markets(limit=100)
        for m in markets.items:
            prev_prices[m.condition_id] = (m.yes_price, m.no_price)
        logger.info("Initial market sync complete", count=len(prev_prices))
    except Exception as exc:
        logger.error("Initial market sync failed", error=str(exc))

    while True:
        await asyncio.sleep(MARKET_POLL_INTERVAL)
        try:
            await _poll_prices(prev_prices)
        except asyncio.CancelledError:
            logger.info("Market poller cancelled")
            return
        except Exception as exc:
            logger.error("Market poll cycle failed", error=str(exc))


# ─── News ingestion task ──────────────────────────────────────────────────────

async def news_ingester() -> None:
    """Periodically ingest news for top markets so RAG context stays fresh."""
    logger.info("News ingester started", interval=NEWS_INGEST_INTERVAL)

    # Stagger startup so it doesn't compete with initial market sync
    await asyncio.sleep(60)

    while True:
        try:
            await _ingest_top_markets()
        except asyncio.CancelledError:
            logger.info("News ingester cancelled")
            return
        except Exception as exc:
            logger.error("News ingest cycle failed", error=str(exc))

        await asyncio.sleep(NEWS_INGEST_INTERVAL)


async def _ingest_top_markets() -> None:
    from app.services.news_ingest import ingest_news_for_market
    from app.core.config import settings

    if not settings.tavily_api_key:
        logger.debug("News ingest skipped: no TAVILY_API_KEY")
        return

    markets = await market_service.list_markets(
        limit=NEWS_TOP_N_MARKETS, sort_by="volume", sort_order="desc"
    )

    total = 0
    for m in markets.items:
        try:
            count = await ingest_news_for_market(m.condition_id, m.question)
            total += count
            await asyncio.sleep(1)  # gentle rate limit between markets
        except Exception as exc:
            logger.warning("News ingest failed for market", condition_id=m.condition_id[:16], error=str(exc))

    logger.info("News ingest cycle complete", markets=len(markets.items), articles=total)
