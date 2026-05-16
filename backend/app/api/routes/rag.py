"""RAG observability endpoints."""
from fastapi import APIRouter, Query
from app.services.qdrant_service import qdrant_service

router = APIRouter(prefix="/rag", tags=["rag"])


@router.get("/stats")
async def rag_stats():
    return await qdrant_service.collection_stats()


@router.get("/search")
async def rag_search(
    q: str = Query(..., min_length=3),
    condition_id: str | None = None,
    limit: int = Query(5, ge=1, le=20),
):
    results = await qdrant_service.search(q, condition_id=condition_id, limit=limit)
    return [
        {
            "title": r.title,
            "content": r.content[:200],
            "url": r.url,
            "condition_id": r.condition_id,
            "score": round(r.score, 4),
        }
        for r in results
    ]
