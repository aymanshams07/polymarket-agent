from fastapi import APIRouter
from app.api.routes import health, markets, ws, forecast, rag

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(markets.router, prefix="/api/v1")
api_router.include_router(forecast.router, prefix="/api/v1")
api_router.include_router(rag.router, prefix="/api/v1")
api_router.include_router(ws.router)
