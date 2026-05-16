"""Thin async HTTP client wrapping the Polymarket Gamma API."""
import json
from typing import Any
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import settings
from app.core.logging import logger

_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


class PolymarketClient:
    def __init__(self) -> None:
        self._http: httpx.AsyncClient | None = None

    async def start(self) -> None:
        self._http = httpx.AsyncClient(
            base_url=settings.polymarket_api_base,
            timeout=_TIMEOUT,
            headers={
                "Accept": "application/json",
                "User-Agent": "PolymarketAI/1.0 (+https://github.com/polymarket-ai)",
            },
            follow_redirects=True,
        )

    async def stop(self) -> None:
        if self._http:
            await self._http.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(httpx.TransportError),
        reraise=True,
    )
    async def fetch_markets(
        self,
        limit: int = 100,
        offset: int = 0,
        active: bool = True,
        closed: bool = False,
        order: str = "volume",
        ascending: bool = False,
    ) -> list[dict[str, Any]]:
        assert self._http, "Client not started — call start() first"
        params: dict[str, Any] = {
            "limit": limit,
            "offset": offset,
            "active": "true" if active else "false",
            "closed": "true" if closed else "false",
            "order": order,
            "ascending": "true" if ascending else "false",
        }
        resp = await self._http.get("/markets", params=params)
        resp.raise_for_status()
        return resp.json()

    async def fetch_top_markets(self, n: int = 100) -> list[dict[str, Any]]:
        """Convenience: fetch top-N active markets by volume."""
        try:
            return await self.fetch_markets(limit=n, active=True, closed=False)
        except Exception as exc:
            logger.error("Polymarket fetch failed", error=str(exc))
            return []


def parse_outcome_prices(
    raw: Any,
) -> tuple[float | None, float | None]:
    """Extract (yes_price, no_price) from the outcomePrices field.

    The field may be a JSON string or already a list.
    """
    try:
        prices = json.loads(raw) if isinstance(raw, str) else raw
        yes = float(prices[0]) if prices else None
        no = float(prices[1]) if len(prices) > 1 else None
        return yes, no
    except Exception:
        return None, None


polymarket_client = PolymarketClient()
