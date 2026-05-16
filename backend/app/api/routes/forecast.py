"""
Forecast API — runs the multi-agent debate and streams results via SSE.

SSE event protocol (each line: data: <json>\\n\\n):
  {"event": "run_start",     "run_id": "...", "question": "..."}
  {"event": "node_start",    "node": "market_analysis", "label": "Market Analysis"}
  {"event": "token",         "node": "...", "content": "..."}
  {"event": "node_complete", "node": "...", "label": "...", "data": {...}}
  {"event": "done",          "run_id": "...", "result": {...}}
  {"event": "error",         "message": "..."}
"""
import json
from typing import Any, AsyncGenerator
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from agents.graphs.debate import debate_graph, make_initial_state, run_debate, NODE_LABELS
from agents.schemas import DebateRequest, DebateResult
from app.services.market_service import market_service
from app.core.config import settings
from app.core.logging import logger

router = APIRouter(prefix="/forecast", tags=["forecast"])

# ─── Guards ───────────────────────────────────────────────────────────────────

async def _get_market_or_404(condition_id: str):
    market = await market_service.get_market(condition_id)
    if not market:
        raise HTTPException(
            status_code=404,
            detail=f"Market '{condition_id}' not found. Trigger a refresh first.",
        )
    return market


def _require_api_key():
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=422,
            detail="ANTHROPIC_API_KEY is not set. Add it to your .env file.",
        )


# ─── SSE helper ───────────────────────────────────────────────────────────────

def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


# ─── Streaming endpoint ───────────────────────────────────────────────────────

@router.get("/stream/{condition_id}")
async def stream_debate(condition_id: str, request: Request):
    """
    Server-Sent Events stream of the multi-agent debate.

    Usage:
        const es = new EventSource('/api/v1/forecast/stream/<id>')
        es.onmessage = (e) => { const msg = JSON.parse(e.data); ... }
    """
    _require_api_key()
    market = await _get_market_or_404(condition_id)

    initial_state = make_initial_state(
        condition_id=condition_id,
        question=market.question,
        market_context=market.model_dump(mode="json"),
    )
    run_id = initial_state["run_id"]

    async def event_stream() -> AsyncGenerator[str, None]:
        current_node: str = ""
        # Accumulate node outputs so we can build DebateResult at the end
        outputs: dict[str, Any] = {}

        yield _sse({
            "event": "run_start",
            "run_id": run_id,
            "question": market.question,
            "condition_id": condition_id,
        })

        try:
            async for event in debate_graph.astream_events(initial_state, version="v2"):
                if await request.is_disconnected():
                    logger.info("SSE client disconnected", run_id=run_id)
                    return

                kind: str = event.get("event", "")
                name: str = event.get("name", "")
                data: dict = event.get("data", {})

                # ── Node lifecycle ──────────────────────────────────
                if kind == "on_chain_start" and name in NODE_LABELS:
                    current_node = name
                    yield _sse({
                        "event": "node_start",
                        "node": name,
                        "label": NODE_LABELS[name],
                    })

                elif kind == "on_chain_end" and name in NODE_LABELS:
                    node_output = data.get("output") or {}
                    node_data = _extract_node_output(name, node_output)
                    outputs[name] = node_data
                    yield _sse({
                        "event": "node_complete",
                        "node": name,
                        "label": NODE_LABELS[name],
                        "data": node_data,
                    })

                # ── LLM token streaming ─────────────────────────────
                elif kind == "on_chat_model_stream":
                    token = _extract_token(data.get("chunk"))
                    if token:
                        yield _sse({
                            "event": "token",
                            "node": current_node,
                            "content": token,
                        })

            # ── Done — build result from accumulated node outputs ──
            result = DebateResult(
                run_id=run_id,
                condition_id=condition_id,
                question=market.question,
                market_analysis=outputs.get("market_analysis"),
                news_summary=outputs.get("news_retrieval"),
                bullish_argument=outputs.get("bullish"),
                bearish_argument=outputs.get("bearish"),
                verdict=outputs.get("judge"),
            )
            yield _sse({
                "event": "done",
                "run_id": run_id,
                "result": result.model_dump(mode="json"),
            })

        except Exception as exc:
            logger.error("SSE stream error", run_id=run_id, error=str(exc))
            yield _sse({"event": "error", "message": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Non-streaming endpoint ───────────────────────────────────────────────────

@router.post("", response_model=DebateResult)
async def run_forecast(body: DebateRequest):
    """Run the full debate synchronously (blocks until complete, ~60-90s)."""
    _require_api_key()
    market = await _get_market_or_404(body.condition_id)
    return await run_debate(
        condition_id=body.condition_id,
        question=market.question,
        market_context=market.model_dump(mode="json"),
    )


# ─── Helpers ─────────────────────────────────────────────────────────────────

_NODE_OUTPUT_FIELDS = {
    "market_analysis": "market_analysis_result",
    "news_retrieval": "news_summary",
    "bullish": "bullish_argument",
    "bearish": "bearish_argument",
    "judge": "verdict",
}


def _extract_node_output(node: str, raw_output: dict) -> dict | None:
    field = _NODE_OUTPUT_FIELDS.get(node)
    if not field:
        return None
    value = raw_output.get(field)
    if value is None:
        return None
    return value.model_dump(mode="json") if hasattr(value, "model_dump") else value


def _extract_token(chunk: Any) -> str:
    """Pull text string out of an AIMessageChunk, skip tool-call chunks."""
    if chunk is None:
        return ""
    try:
        content = chunk.content
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                c.get("text", "")
                for c in content
                if isinstance(c, dict) and c.get("type") == "text"
            )
    except Exception:
        pass
    return ""
