# Polymarket AI Platform

A multi-agent AI system for real-time prediction market analysis. Pulls live market data from Polymarket, runs a five-node LangGraph debate pipeline backed by Claude Sonnet, retrieves relevant news via a RAG pipeline, and streams the full reasoning process to a Next.js frontend over SSE and WebSocket.

---

## Features

- **Live market feed** — Polymarket data ingested every 30 seconds, broadcast to clients over WebSocket
- **Multi-agent debate** — Five LangGraph nodes run sequentially: market analysis → news retrieval → bullish agent → bearish agent → judge
- **RAG news pipeline** — Tavily search + local fastembed embeddings stored in Qdrant, retrieved by semantic similarity per market
- **Streaming UI** — Agent reasoning streams token-by-token via Server-Sent Events; price updates stream via WebSocket
- **Structured LLM output** — Every agent node uses Pydantic-constrained output via Claude's tool use feature
- **Fully containerized** — PostgreSQL, Qdrant, FastAPI, and Next.js all run via Docker Compose

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Orchestration | LangGraph + LangChain |
| LLM | Claude Sonnet (Anthropic API) |
| Backend | FastAPI + Python 3.11 (fully async) |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 async |
| Vector Store | Qdrant v1.9.2 |
| Embeddings | fastembed (BAAI/bge-small-en-v1.5, local) |
| News Search | Tavily API |
| Frontend | Next.js 15 + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Real-time | SWR + WebSocket + EventSource (SSE) |
| Infra | Docker Compose |

---

## Architecture

```
[Polymarket Gamma API]
        ↓ every 30s
[FastAPI Backend]
    ├── PostgreSQL  (market state)
    ├── Qdrant      (news vectors)
    ├── WebSocket   (live price broadcast)
    └── LangGraph Debate Engine
            ├── market_analysis
            ├── news_retrieval  ←→ Tavily + Qdrant
            ├── bullish_node
            ├── bearish_node
            └── judge_node
                    ↓ SSE stream
[Next.js Frontend]
    ├── SWR polling       (market list)
    ├── WebSocket         (price updates)
    └── EventSource       (agent stream)
```

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- API keys for Anthropic, Tavily, and NewsAPI (OpenAI optional)

### Setup

```bash
# Clone the repo
git clone https://github.com/aymanshams07/polymarket-agent.git
cd polymarket-agent

# Copy and fill in your environment variables
cp .env.example .env
# Edit .env with your API keys

# Start all services
make up

# Watch logs
make logs
```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:8000`.

### Local Development (without Docker)

```bash
# Backend
make dev-backend

# Frontend (separate terminal)
make dev-frontend
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the following:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key (required) |
| `TAVILY_API_KEY` | Tavily search API key (required for news) |
| `NEWSAPI_KEY` | NewsAPI key (optional fallback) |
| `OPENAI_API_KEY` | OpenAI key (optional, not used by default) |
| `DATABASE_URL` | PostgreSQL connection string |
| `QDRANT_HOST` / `QDRANT_PORT` | Qdrant connection |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/health/ready` | Readiness check (tests DB) |
| GET | `/api/v1/markets` | List markets (filter, sort, paginate) |
| GET | `/api/v1/markets/{id}` | Single market detail |
| GET | `/api/v1/forecast/stream/{id}` | SSE stream — runs full AI debate |
| POST | `/api/v1/forecast` | Synchronous forecast (blocks ~60–90s) |
| GET | `/api/v1/rag/search` | Semantic news search |
| GET | `/api/v1/rag/stats` | Vector store stats |
| WS | `/ws/markets` | WebSocket — live price updates |

---

## Project Structure

```
polymarket-ai-platform/
├── backend/
│   ├── agents/          # LangGraph graphs, nodes, tools, prompts
│   ├── app/
│   │   ├── api/         # FastAPI routes
│   │   ├── core/        # Config, logging, background tasks, WS manager
│   │   ├── db/          # SQLAlchemy models and engine
│   │   ├── schemas/     # Pydantic API schemas
│   │   └── services/    # Polymarket client, market service, Qdrant, news ingest
│   └── tests/
├── frontend/
│   └── src/
│       ├── app/         # Next.js App Router pages
│       ├── components/  # UI components (markets, analysis, forecast)
│       ├── hooks/       # useDebateStream, useMarkets, useMarketSocket
│       └── types/       # TypeScript interfaces
├── infra/
│   ├── postgres/        # DB init SQL
│   └── qdrant/          # Qdrant config
└── docker-compose.yml
```

---

## License

MIT
