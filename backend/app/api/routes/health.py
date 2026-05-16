from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.engine import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}


@router.get("/health/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """Deep health check — verifies DB connectivity."""
    await db.execute(text("SELECT 1"))
    return {"status": "ready", "db": "ok"}
