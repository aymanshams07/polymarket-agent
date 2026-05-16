from fastapi import APIRouter, HTTPException, Query
from app.schemas.market import MarketList, MarketRead
from app.services.market_service import market_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("", response_model=MarketList)
async def list_markets(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = None,
    search: str | None = Query(None, min_length=2),
    sort_by: str = Query("volume", pattern="^(volume|volume_24hr|liquidity|end_date|price_change)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    return await market_service.list_markets(
        limit=limit,
        offset=offset,
        category=category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/categories", response_model=list[str])
async def list_categories():
    return await market_service.get_categories()


@router.post("/refresh", status_code=202)
async def trigger_refresh():
    """Manually trigger a market sync. Useful for development."""
    import asyncio
    asyncio.create_task(market_service.sync_markets())
    return {"status": "refresh queued"}


@router.get("/{condition_id}", response_model=MarketRead)
async def get_market(condition_id: str):
    market = await market_service.get_market(condition_id)
    if not market:
        raise HTTPException(status_code=404, detail="Market not found")
    return market
