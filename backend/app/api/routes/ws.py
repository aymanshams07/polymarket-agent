"""WebSocket endpoint — sends snapshot on connect, receives price_update broadcasts."""
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.ws_manager import ws_manager
from app.core.logging import logger
from app.services.market_service import market_service

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/markets")
async def markets_ws(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        # Send current snapshot immediately on connect
        market_list = await market_service.list_markets(limit=100)
        await ws_manager.send_to(ws, {
            "type": "snapshot",
            "markets": [m.model_dump(mode="json") for m in market_list.items],
            "total": market_list.total,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Keep connection open; client pings keep it alive
        while True:
            data = await ws.receive_text()
            # Handle ping/pong so proxies don't time out
            if data == "ping":
                await ws_manager.send_to(ws, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.error("WS handler error", error=str(exc))
    finally:
        ws_manager.disconnect(ws)
