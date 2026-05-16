# Polymarket AI Platform

## Project overview
Multi-agent AI platform for Polymarket prediction market analysis. Includes real-time market data, AI forecasting, multi-agent debate, and RAG over news.

## Tech stack
- **Frontend**: Next.js 15 + TypeScript + Tailwind + shadcn/ui (in `frontend/`)
- **Backend**: FastAPI + Python 3.11 (in `backend/`)
- **AI orchestration**: LangGraph (in `backend/agents/`)
- **Database**: PostgreSQL via SQLAlchemy async (models in `backend/app/db/models.py`)
- **Vector DB**: Qdrant (collections managed in `backend/app/services/`)
- **Infra**: Docker Compose (`docker-compose.yml`)

## Common commands
```bash
make up              # start all services
make down            # stop all services
make logs            # tail compose logs
make dev-backend     # run backend locally with hot-reload
make dev-frontend    # run frontend locally
make test            # run backend tests
make migrate         # run alembic migrations
```

## Key conventions
- All API routes live under `/api/v1/`
- FastAPI dependency injection for DB sessions via `get_db()`
- Pydantic schemas in `backend/app/schemas/` — separate from ORM models
- LangGraph agents in `backend/agents/` — graphs in `graphs/`, nodes in `nodes/`, tools in `tools/`
- Frontend fetches via SWR with `fetcher` from `src/lib/api.ts`
- All env vars loaded from `.env` (copy from `.env.example`)

## Build phases
1. **Phase 1 (done)**: Infrastructure, Docker, FastAPI skeleton, Next.js skeleton
2. **Phase 2**: Polymarket API client + data ingest + Postgres models
3. **Phase 3**: LangGraph single forecasting agent
4. **Phase 4**: RAG pipeline (Qdrant + news)
5. **Phase 5**: Multi-agent debate system
6. **Phase 6**: Streaming UI (SSE/WebSockets)
