"""
Qdrant service — manages the news article vector store.

Design choices:
  - AsyncQdrantClient for all I/O (non-blocking in FastAPI)
  - fastembed BAAI/bge-small-en-v1.5 for local embeddings (no extra API key)
  - Embeddings computed in a thread-pool executor (fastembed is CPU-bound sync)
  - One collection: "polymarket_news"
  - Each point payload includes condition_id for per-market filtering
"""
import asyncio
import hashlib
import uuid
from dataclasses import dataclass
from typing import Any
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue,
    UpdateStatus,
)
from tenacity import retry, stop_after_attempt, wait_fixed, before_log
from app.core.config import settings
from app.core.logging import logger

COLLECTION = "polymarket_news"
VECTOR_DIM = 384          # BAAI/bge-small-en-v1.5
BATCH_SIZE = 32


@dataclass
class NewsDoc:
    url: str
    title: str
    content: str
    condition_id: str | None = None
    source: str | None = None
    published_date: str | None = None


@dataclass
class SearchResult:
    title: str
    content: str
    url: str
    condition_id: str | None
    score: float


class QdrantService:
    def __init__(self) -> None:
        self._client: AsyncQdrantClient | None = None
        self._embedder: Any = None          # fastembed.TextEmbedding (lazy)

    # ── Lifecycle ────────────────────────────────────────────────

    async def start(self) -> None:
        self._client = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )
        await self._connect_with_retry()
        logger.info("Qdrant service started", host=settings.qdrant_host)

    @retry(stop=stop_after_attempt(15), wait=wait_fixed(2))
    async def _connect_with_retry(self) -> None:
        await self._ensure_collection()

    async def stop(self) -> None:
        if self._client:
            await self._client.close()

    async def _ensure_collection(self) -> None:
        response = await self._client.get_collections()
        existing = {c.name for c in response.collections}
        if COLLECTION not in existing:
            await self._client.create_collection(
                collection_name=COLLECTION,
                vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
            )
            # Index condition_id payload field for fast filtering
            await self._client.create_payload_index(
                collection_name=COLLECTION,
                field_name="condition_id",
                field_schema="keyword",
            )
            logger.info("Qdrant collection created", name=COLLECTION)

    # ── Embeddings ───────────────────────────────────────────────

    def _get_embedder(self):
        if self._embedder is None:
            from fastembed import TextEmbedding
            self._embedder = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        return self._embedder

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        """Run fastembed in executor so we don't block the event loop."""
        embedder = self._get_embedder()
        loop = asyncio.get_running_loop()
        vectors = await loop.run_in_executor(
            None,
            lambda: [v.tolist() for v in embedder.embed(texts)],
        )
        return vectors

    # ── Write ────────────────────────────────────────────────────

    def _doc_id(self, url: str) -> str:
        """Deterministic UUID from URL so we can safely re-ingest."""
        hex_digest = hashlib.md5(url.encode()).hexdigest()
        return str(uuid.UUID(hex_digest))

    async def upsert_articles(self, docs: list[NewsDoc]) -> int:
        if not docs:
            return 0
        assert self._client

        texts = [f"{d.title}. {d.content[:400]}" for d in docs]
        vectors = await self._embed(texts)

        points = [
            PointStruct(
                id=self._doc_id(doc.url),
                vector=vec,
                payload={
                    "title": doc.title,
                    "content": doc.content[:800],
                    "url": doc.url,
                    "condition_id": doc.condition_id,
                    "source": doc.source or "",
                    "published_date": doc.published_date or "",
                },
            )
            for doc, vec in zip(docs, vectors)
        ]

        # Upsert in batches
        upserted = 0
        for i in range(0, len(points), BATCH_SIZE):
            batch = points[i : i + BATCH_SIZE]
            result = await self._client.upsert(
                collection_name=COLLECTION, points=batch, wait=True
            )
            if result.status == UpdateStatus.COMPLETED:
                upserted += len(batch)

        logger.info("Qdrant upsert complete", count=upserted)
        return upserted

    # ── Search ───────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        condition_id: str | None = None,
        limit: int = 6,
    ) -> list[SearchResult]:
        assert self._client

        [query_vec] = await self._embed([query])

        query_filter = None
        if condition_id:
            query_filter = Filter(
                must=[FieldCondition(key="condition_id", match=MatchValue(value=condition_id))]
            )

        hits = await self._client.search(
            collection_name=COLLECTION,
            query_vector=query_vec,
            query_filter=query_filter,
            limit=limit,
            with_payload=True,
        )

        return [
            SearchResult(
                title=h.payload.get("title", ""),
                content=h.payload.get("content", ""),
                url=h.payload.get("url", ""),
                condition_id=h.payload.get("condition_id"),
                score=h.score,
            )
            for h in hits
        ]

    # ── Stats ────────────────────────────────────────────────────

    async def collection_stats(self) -> dict:
        try:
            info = await self._client.get_collection(COLLECTION)
            return {
                "collection": COLLECTION,
                "points": info.points_count,
                "status": info.status.value,
                "vector_size": VECTOR_DIM,
            }
        except Exception as exc:
            return {"error": str(exc)}


qdrant_service = QdrantService()
