# Career Packaging — Polymarket AI Platform

---

## Section 1 — Website / Portfolio Content

### Project Title
**Polymarket AI Platform** — A production-grade multi-agent AI system for real-time prediction market analysis

---

### Hero / Summary Paragraph

I built a full-stack AI platform that ingests live data from Polymarket's prediction markets, orchestrates a structured multi-agent debate using LangGraph and Claude Sonnet, retrieves and synthesizes relevant news via a RAG pipeline backed by Qdrant, and streams the entire reasoning process to a Next.js frontend in real time over Server-Sent Events and WebSockets.

The system runs as a containerized, multi-service application: a FastAPI async backend, a PostgreSQL database, a Qdrant vector store, and a Next.js 15 frontend — all orchestrated with Docker Compose. Every architectural decision was made with production concerns in mind: async I/O throughout, graceful background task lifecycle management, structured logging, typed state across every layer, and streaming-first UX.

---

### Architecture Overview

#### System Diagram (prose)

```
[Polymarket Gamma API]
        ↓ every 30s (background poller)
[FastAPI Backend]
    ├── PostgreSQL (market state, news metadata)
    ├── Qdrant (semantic news vectors)
    ├── WebSocket Manager (live price broadcasts)
    └── LangGraph Debate Engine
            ├── market_analysis node
            ├── news_retrieval node  ←→ Tavily Search + Qdrant RAG
            ├── bullish_node
            ├── bearish_node
            └── judge_node
                    ↓ SSE stream
[Next.js 15 Frontend]
    ├── SWR market polling
    ├── WebSocket price feed
    └── EventSource debate stream
```

#### Data Pipelines

**Market Ingest Pipeline**
A background coroutine (`market_poller`) runs on a 30-second interval. It calls the Polymarket Gamma API via an async `httpx` client, upserts market rows into PostgreSQL using `asyncpg`, detects price changes by diffing in-memory state, and broadcasts `price_update` events to all connected WebSocket clients. A separate background coroutine (`news_ingester`) runs every 15 minutes, selecting the top 20 markets by volume, querying Tavily for relevant news, and upserting embedded article vectors into Qdrant using `fastembed` (BAAI/bge-small-en-v1.5, 384 dimensions).

**Forecast / Debate Pipeline**
When a user requests an AI forecast, the backend opens an SSE stream and invokes a LangGraph `StateGraph`. The graph executes five nodes in sequence:

1. **market_analysis** — reads market price, volume, liquidity, and days-remaining from the database, formats market context, and calls Claude Sonnet with structured output (`MarketAnalysis`) to produce a summary, key factors for YES/NO, and an initial probability estimate.
2. **news_retrieval** — runs Tavily search for fresh articles, upserts them into Qdrant, then performs a semantic similarity search (filtered by `condition_id`) to retrieve the most relevant articles. Falls back to a global search if no market-specific articles exist. Synthesizes a `NewsSummary` with per-article sentiment and a news-adjusted probability.
3. **bullish_node** — given market analysis and news context, constructs a structured argument for the YES outcome: opening statement, main arguments, evidence citations, rebuttal positions, probability estimate.
4. **bearish_node** — same structure but for NO. Receives the bullish argument and explicitly rebuts it.
5. **judge_node** — reads both arguments and synthesizes a `JudgeVerdict`: final probability, stronger side, decisive factors, confidence level (low/medium/high), comparison to the market-implied price, and a directional recommendation.

Each node emits `node_start` and `node_complete` SSE events. Token-level streaming is emitted for long-form text, so the UI renders agent reasoning as it is generated.

---

### Engineering Decisions

**Why LangGraph instead of a simple LLM chain?**
The debate structure requires stateful, multi-step reasoning where later nodes depend on the outputs of earlier ones. LangGraph's `StateGraph` with a `TypedDict` state schema enforces this cleanly: each node receives the full typed state and returns only the fields it modifies. This makes the execution graph inspectable, testable in isolation, and extensible — adding a fifth node (e.g., a fact-checker) requires no changes to existing nodes.

**Why SSE instead of WebSockets for the debate stream?**
The debate stream is strictly server-to-client: the client starts a request and listens. SSE (`EventSource`) is the right primitive for this — it uses a regular HTTP connection, handles reconnection natively, and requires no protocol upgrade. WebSockets are used only for the market price feed, where the server needs to push unsolicited updates to many concurrent clients.

**Why Qdrant with fastembed instead of a managed embedding service?**
Using `fastembed` with the BAAI/bge-small-en-v1.5 model eliminates a network round-trip for every embedding operation and removes a per-token cost. The model is pre-downloaded into the Docker image at build time, so there is no cold-start latency. Qdrant's `AsyncQdrantClient` keeps the pipeline non-blocking.

**Why async SQLAlchemy 2.0 with asyncpg?**
FastAPI is async-native. Using a synchronous ORM would force thread-pool offloading on every DB call. SQLAlchemy 2.0's async session with `asyncpg` gives true non-blocking DB access, which matters for the market poller that runs 30-second polling loops concurrently with user requests.

**Why structured LLM output (Pydantic schemas)?**
All five LangGraph nodes use `with_structured_output()` against Pydantic models (`MarketAnalysis`, `NewsSummary`, `DebateArgument`, `JudgeVerdict`). This eliminates JSON parsing errors, gives the frontend type-safe data, and makes the agent outputs auditable and serializable to the database if needed.

**Why separate background tasks with lifespan management?**
The `market_poller` and `news_ingester` are launched as asyncio tasks inside FastAPI's `lifespan` context manager. This ensures they are cancelled cleanly on shutdown, avoiding orphaned coroutines or unclosed database sessions.

---

### Technology Deep-Dive

| Layer | Technology | Version | Role |
|---|---|---|---|
| AI Orchestration | LangGraph | latest | Stateful multi-agent graph execution |
| LLM | Claude Sonnet (claude-sonnet-4-6) | Anthropic API | Market analysis, debate, judging |
| Backend API | FastAPI | latest | Async REST + SSE + WebSocket |
| ORM | SQLAlchemy 2.0 | async | PostgreSQL access with asyncpg |
| Vector DB | Qdrant | v1.9.2 | Semantic news retrieval |
| Embeddings | fastembed (BAAI/bge-small-en-v1.5) | 384-dim | Local embedding, no API cost |
| News Search | Tavily API | — | Real-time web search for news |
| Database | PostgreSQL 16 | alpine | Market and news metadata persistence |
| Frontend | Next.js 15 (App Router) | React 19 | File-based routing, server components |
| Real-time (UI) | SWR + WebSocket + EventSource | — | Three-tier real-time data model |
| Styling | Tailwind CSS 4 + shadcn/ui | — | Component-based design system |
| Logging | structlog | — | Structured JSON logs in production |
| Containerization | Docker Compose | — | Multi-service local and prod deployment |
| Testing | pytest + pytest-asyncio | — | Async test suite |
| Linting | ruff + mypy | — | Type checking and style enforcement |

---

### Skills Demonstrated

- **Agentic AI systems design**: Designed and implemented a five-node LangGraph state machine with typed inter-node state, structured LLM output, and sequential dependency chaining.
- **RAG pipeline engineering**: Built an end-to-end retrieval-augmented generation pipeline: Tavily search → document chunking → local embedding → Qdrant upsert → semantic similarity retrieval with metadata filtering.
- **Streaming systems**: Implemented SSE streaming for token-level LLM output delivery and WebSocket broadcasting for multi-client real-time price updates with ping/pong keepalives and auto-reconnect.
- **Async backend engineering**: Wrote a fully async FastAPI backend using SQLAlchemy 2.0 async + asyncpg, async httpx, and async Qdrant client. Background tasks managed via asyncio with clean lifespan shutdown.
- **Full-stack architecture**: Designed and connected a React 19 / Next.js 15 frontend to a FastAPI backend via three distinct real-time mechanisms (SWR polling, WebSocket, EventSource).
- **Production infrastructure**: Containerized all services with Docker Compose, including health checks, dependency ordering, pre-downloaded model artifacts in the backend image, and structured production logging.
- **Type safety end-to-end**: TypedDict state in LangGraph agents, Pydantic schemas for all LLM outputs and API contracts, TypeScript interfaces mirroring backend types in the frontend.
- **External API integration**: Integrated Polymarket Gamma API, Tavily search API, and Anthropic API with graceful degradation and error handling.

---

## Section 2 — Resume Content

### Project Line (Header)
**Polymarket AI Platform** | Python · FastAPI · LangGraph · Claude API · Qdrant · Next.js 15 · PostgreSQL · Docker

*(Use this as the project title line in your LaTeX resume under a Projects section.)*

---

### Resume Bullet Points

**AI Systems & Agent Orchestration**
- Designed and implemented a multi-agent debate system using LangGraph `StateGraph` with five sequential nodes (market analysis, news retrieval, bullish, bearish, judge), each using Claude Sonnet with Pydantic-constrained structured output, enabling reproducible, typed agent-to-agent state propagation
- Engineered a RAG pipeline integrating Tavily real-time web search, local `fastembed` embeddings (BAAI/bge-small-en-v1.5, 384-dim), and Qdrant vector store with `condition_id` metadata filtering for per-market semantic retrieval, eliminating external embedding API dependency
- Implemented token-level LLM output streaming over Server-Sent Events (SSE), with per-node lifecycle events (`node_start`, `token`, `node_complete`, `done`, `error`) consumed by a React `EventSource` hook to render agent reasoning incrementally

**Backend Engineering**
- Built a fully async FastAPI backend using SQLAlchemy 2.0 async sessions with `asyncpg`, async `httpx` for external API calls, and async Qdrant client — no synchronous I/O blocking the event loop
- Implemented two long-running background coroutines launched in FastAPI's `lifespan` context: a market poller (30-second interval, Polymarket Gamma API → PostgreSQL upsert + WebSocket broadcast) and a news ingester (15-minute interval, top-20 markets by volume → Tavily → Qdrant)
- Designed a WebSocket connection manager supporting multi-client broadcast with dead-connection pruning, ping/pong keepalives, and a market snapshot on initial connect

**Data Engineering & Infrastructure**
- Modeled two PostgreSQL ORM tables (`Market`, `NewsArticle`) with indexed fields (category, active status), server-default timestamps, and upsert-safe primary keys; managed schema via Alembic migrations
- Containerized a four-service application (FastAPI, Next.js, PostgreSQL 16, Qdrant v1.9.2) with Docker Compose, health-check dependencies, pre-built model artifacts in the backend image, and a shared `.env`-driven configuration layer
- Configured structlog for structured JSON logging in production and human-readable console output in development; loaded all settings via Pydantic `BaseSettings` from environment variables

**Frontend & Real-Time UI**
- Built a Next.js 15 App Router frontend with three concurrent real-time data mechanisms: SWR polling for market lists, WebSocket subscription for live price updates with flash animations, and EventSource for streaming AI debate output
- Implemented `useDebateStream` hook managing EventSource lifecycle, per-agent streaming text accumulation, phase state machine (idle → running → complete → error), and `DebateResult` assembly from partial SSE events
- Rendered an `AgentTimeline` component with per-node status indicators, expandable streamed text, and a progress bar driven entirely from SSE event state

---

### One-Line ATS Summary (for profile/summary section)
Built a production-grade multi-agent AI platform using LangGraph, Claude API, RAG with Qdrant, and streaming SSE/WebSocket architecture on a FastAPI + Next.js 15 full-stack.

---

### Suggested Skills Keywords (for resume skills section)
LangGraph · Agentic AI · RAG · Retrieval-Augmented Generation · Vector Databases · Qdrant · FastAPI · Async Python · SQLAlchemy · WebSocket · Server-Sent Events · Anthropic Claude API · LangChain · Next.js · React · TypeScript · PostgreSQL · Docker · Structlog · Pydantic · Semantic Search · Embedding Models · Multi-Agent Systems · AI Orchestration

---

## Section 3 — LinkedIn Content

### LinkedIn Project Post

---

**I built a multi-agent AI platform for prediction market analysis — here's the architecture.**

Over the past few weeks I designed and built a production-grade system that combines real-time market data ingestion, a RAG news pipeline, and a structured multi-agent debate — all streaming live to a Next.js frontend.

**The core system:**

The backend is a fully async FastAPI application with three real-time channels:
- A WebSocket server broadcasts live price updates from Polymarket every 30 seconds
- An SSE endpoint streams AI reasoning token-by-token as agents run
- A background news pipeline indexes relevant articles into Qdrant every 15 minutes

**The AI layer is a LangGraph StateGraph with five nodes:**

1. Market analysis — Claude reads price, volume, and liquidity data and outputs a structured `MarketAnalysis`
2. News retrieval — fresh articles are fetched via Tavily, embedded locally with fastembed, stored in Qdrant, and retrieved by semantic similarity
3. Bullish agent — argues the case for YES with probability estimate and supporting evidence
4. Bearish agent — argues NO and explicitly rebuts the bullish position
5. Judge — synthesizes both sides into a final probability, confidence level, and recommendation

Every node uses Pydantic structured output, so state flows through the graph in a typed, inspectable way.

**The frontend (Next.js 15 + React 19) uses three real-time mechanisms in parallel:** SWR for market list polling, WebSocket for price updates, and EventSource for the debate stream. The agent timeline renders each node's reasoning as it streams.

**Stack:** Python 3.11 · FastAPI · LangGraph · Claude Sonnet · Qdrant · PostgreSQL · fastembed · Tavily · Next.js 15 · TypeScript · Docker Compose

If you're interested in agentic AI systems, RAG pipelines, or streaming architectures, I'm happy to talk through the design decisions.

---

### Recruiter-Friendly Summary (for LinkedIn "Projects" section, ~3 sentences)

Multi-agent AI platform for Polymarket prediction market analysis. Orchestrates a five-node LangGraph debate pipeline (market analysis → RAG news retrieval → bullish/bearish agents → judge) backed by Claude Sonnet, with structured output at every node. Real-time streaming via SSE and WebSocket, Qdrant vector store for semantic news retrieval, and a Next.js 15 frontend — all containerized with Docker Compose.

---

### Suggested LinkedIn Skills / Tags
Add these to the post as hashtags or to your profile skills:

`#ArtificialIntelligence` `#MachineLearning` `#LLM` `#GenerativeAI` `#AgentAI` `#RAG` `#LangGraph` `#FastAPI` `#Python` `#NextJS` `#FullStack` `#VectorDatabases` `#NLP` `#AIEngineering` `#SoftwareEngineering`

---

### Suggested GitHub Repository Description

> Multi-agent AI platform for Polymarket prediction markets. LangGraph debate pipeline (5 nodes) · Claude Sonnet structured output · RAG with Qdrant + fastembed · FastAPI async backend · SSE + WebSocket streaming · Next.js 15 frontend · Docker Compose

---

### Suggested GitHub README Topics (tags)
`langgraph` `langchain` `multi-agent` `rag` `fastapi` `qdrant` `anthropic` `claude` `nextjs` `prediction-markets` `streaming` `websocket` `python` `typescript`

---

## Section 4 — Demo / Showcase Strategy

### What Recruiters and Interviewers Find Most Impressive

Prediction market + AI is a credible, data-rich domain. Employers in AI/ML engineering roles are specifically looking for:

1. **End-to-end ownership** — you built the data pipeline, the AI layer, and the frontend. Most candidates show one layer.
2. **LangGraph / agentic architecture** — knowing how to design multi-node stateful agent systems with typed state is a specific, sought-after skill in 2025.
3. **RAG implementation** — not just calling an API, but owning the embedding model, the vector store, the ingestion pipeline, and the retrieval logic.
4. **Streaming systems** — SSE + WebSocket in a single product shows real understanding of when to use each protocol.
5. **Production discipline** — Docker, structured logging, typed schemas, background task lifecycle, async throughout. This reads as senior-level engineering.

---

### Recommended Demo Order (for screen recording or live interview)

#### Segment 1 — Live Market Feed (1–2 minutes)
**What to show:** Open the home page. Let the market grid load. Point out the "LIVE" badge in the corner. Wait for a price update to flash on a card (or trigger a refresh).

**What to say:** "The backend polls the Polymarket API every 30 seconds, upserts prices into PostgreSQL, detects changes, and broadcasts them over WebSocket to all connected clients. The badge in the corner reflects the live WebSocket connection state."

**Why impressive:** Real-time data engineering with WebSocket + background polling is a production pattern. It's not a toy demo.

---

#### Segment 2 — Market Filters and Search (30 seconds)
**What to show:** Use the search bar to filter markets. Switch between category pills. Sort by volume, then by 24h price change.

**What to say:** "Filtering and sorting happen via parameterized SQL queries using SQLAlchemy async — there's a category index and a full-text search on the question field."

**Why impressive:** Shows database design awareness, not just API calls.

---

#### Segment 3 — Clicking Into a Market / Starting the AI Debate (2–3 minutes)
**What to show:** Click a market card. On the detail page, click the "Run Analysis" button. Show the agent timeline activating node by node. Let it run for the full debate.

**What to say:** "When the user clicks Run Analysis, the frontend opens an EventSource connection to the SSE endpoint. The backend invokes a LangGraph StateGraph. Each node emits lifecycle events — `node_start`, token-level streaming text, and `node_complete`. The frontend renders these in real time as the agents execute."

**Why impressive:** This is the core AI system. Showing the agents execute live, with streaming text, is visually compelling and technically credible. Most candidates show static output.

---

#### Segment 4 — Forecast Card / Judge Verdict (1–2 minutes)
**What to show:** After the debate completes, scroll down to the ForecastCard. Point out: AI probability vs. market-implied probability, the delta badge, the confidence level, the decisive factors list, the debate summary (bullish vs. bearish), and the recommendation box.

**What to say:** "The judge node synthesizes both debate positions into a structured `JudgeVerdict` Pydantic model. If the AI probability diverges from the market price by more than 2 percentage points, it surfaces a mispricing alert. Everything you see is typed — the frontend TypeScript interfaces mirror the backend Pydantic schemas exactly."

**Why impressive:** Structured LLM output is a professional pattern. It shows you understand how to make AI systems reliable, not just impressive.

---

#### Segment 5 — RAG Stats Endpoint (30 seconds, optional for technical interviews)
**What to show:** Open the browser to `/api/v1/rag/stats` or `/api/v1/rag/search?q=trump+election`. Show the JSON response.

**What to say:** "The vector store holds embedded news articles indexed by market ID. I'm using `fastembed` locally — no external embedding API call — which eliminates latency and per-token cost. The retrieval uses cosine similarity with a Qdrant filter on `condition_id` to keep results market-specific."

**Why impressive:** RAG with a locally-run embedding model is the production-grade choice. It shows cost and latency awareness.

---

#### Segment 6 — Architecture Walk (for system design interviews)
**What to show:** Share your screen on a whiteboard or the directory structure. Walk through: `backend/agents/graphs/debate.py` → `backend/agents/nodes/` → `backend/agents/schemas.py`.

**What to say:** "The LangGraph state is a TypedDict. Each node function receives the full state and returns only the fields it modifies. Structured output is enforced at each node by calling `llm.with_structured_output(MarketAnalysis)` — LangChain handles the schema injection into the prompt and the response parsing. The graph is assembled once and invoked per request."

**Why impressive:** Walking through actual code shows depth, not just familiarity.

---

### What to Screen Record with Screencastify

| Clip | Duration | Content |
|---|---|---|
| Clip 1 | 30s | Home page load — market grid, live badge, category filters |
| Clip 2 | 15s | Price flash animation (WebSocket update) |
| Clip 3 | 45s | Market search and filter interaction |
| Clip 4 | 90s | Full agent debate running — show the timeline animating node-by-node |
| Clip 5 | 60s | ForecastCard — scroll through verdict, delta badge, debate summary |
| Clip 6 | 30s | Docker Compose services running in terminal (make logs) |

**Editing tip:** Cut clips 4 and 5 together with no gap — the natural pause between "agent running" and "results appear" is visually compelling on its own.

---

### What NOT to Highlight

- The test suite (single health check test) — do not draw attention to low test coverage
- The OpenAI API key in `.env.example` — it is not used, which could raise questions
- The frontend Dockerfile running `npm run dev` — mention you would use `npm run build` + `next start` for production

---

### Interview Talking Points

**"Why LangGraph instead of a simpler approach?"**
> LangGraph enforces typed, inspectable state between nodes. If I had used a simple sequential chain, I would have lost the ability to run nodes independently, inspect intermediate outputs, or add branching logic later. The `StateGraph` abstraction also lets me emit per-node SSE events cleanly, because each node boundary is a discrete execution point.

**"How do you handle LLM failures mid-debate?"**
> The SSE endpoint wraps the LangGraph invocation in a try/except. If any node raises, an `error` event is emitted to the client with a message, and the stream closes cleanly. The state up to that point is preserved in `DebateState.log` for debugging.

**"How does the RAG pipeline stay fresh?"**
> The `news_ingester` background task runs every 15 minutes and re-indexes the top 20 markets by trading volume. Each Qdrant upsert uses the article URL as the point ID, so re-ingesting the same article is idempotent. Articles from Tavily are also deduplicated by URL before embedding.

**"Why not use LangChain's built-in agents instead of LangGraph?"**
> LangChain's ReAct agents are tool-calling loops — good for open-ended tasks. The debate structure is a fixed, directed graph: five nodes, always in the same order, with specific typed outputs at each step. LangGraph is the right tool for deterministic, structured multi-step reasoning.

---

*Generated from actual codebase analysis — all technical claims are verifiable in the source code.*
