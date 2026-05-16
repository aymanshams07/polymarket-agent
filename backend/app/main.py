import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.engine import engine, Base
from app.api.router import api_router
from app.services.polymarket_client import polymarket_client
from app.services.qdrant_service import qdrant_service
from app.core.background import market_poller, news_ingester


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting Polymarket AI Platform", environment=settings.environment)

    # Database
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")

    # External clients
    await polymarket_client.start()
    await qdrant_service.start()

    # Background tasks
    poller_task = asyncio.create_task(market_poller())
    ingest_task = asyncio.create_task(news_ingester())

    yield

    # Graceful shutdown
    for task in (poller_task, ingest_task):
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    await polymarket_client.stop()
    await qdrant_service.stop()
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Polymarket AI Platform",
    version="0.1.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
