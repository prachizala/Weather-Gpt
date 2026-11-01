"""Conversational chat endpoint integrating tool calling, RAG, streaming, and rate limits."""

from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse

from backend.app.api.deps import get_chat_orchestrator
from backend.app.schemas.chat import ChatRequest, ChatResponse
from backend.app.services.chat_orchestrator import ChatOrchestrator
from backend.app.services.session_store import session_store
from backend.app.utils.rate_limit import check_chat_rate_limit_and_size

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Send Conversational Meteorological Query",
    dependencies=[Depends(check_chat_rate_limit_and_size)],
)
async def chat_interaction(
    request: ChatRequest,
    orchestrator: ChatOrchestrator = Depends(get_chat_orchestrator),
) -> ChatResponse:
    """Process natural language meteorological questions using tool-calling and grounded verification.

    Returns the contract:
      - answer: Factually verified explanation
      - intent: Executed tool or query category
      - location: Resolved geographic location
      - valid_period: Evaluated temporal window
      - weather_data: Validated meteorological payload
      - sources: Verified data sources with attribution
      - knowledge_citations: Explanatory document citations
      - limitations: Operational horizon caps and regional warnings
      - language: Response language code (en, hi, gu)
      - latency_stages: Latency breakdown in seconds per stage
    """
    preferred_unit = request.units.get("temperature", "celsius") if request.units else "celsius"
    session_id = request.session_id or request.conversation_id

    response = await orchestrator.handle_chat(
        message=request.message,
        session_id=session_id,
        units=preferred_unit,
        location=request.location,
    )
    return response


@router.post(
    "/stream",
    summary="Stream Conversational Meteorological Query via SSE",
    dependencies=[Depends(check_chat_rate_limit_and_size)],
)
async def stream_chat_interaction(
    request: ChatRequest,
    orchestrator: ChatOrchestrator = Depends(get_chat_orchestrator),
) -> StreamingResponse:
    """Stream natural language explanation tokens using Server-Sent Events (SSE)."""
    preferred_unit = request.units.get("temperature", "celsius") if request.units else "celsius"
    session_id = request.session_id or request.conversation_id

    generator = orchestrator.stream_chat(
        message=request.message,
        session_id=session_id,
        units=preferred_unit,
        location=request.location,
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/session/clear", summary="Clear Session Context")
@router.delete("/session", summary="Clear Session Context")
async def clear_chat_session(
    session_id: Optional[str] = Query(None, description="Specific session identifier to clear. If omitted, all sessions are cleared."),
    orchestrator: ChatOrchestrator = Depends(get_chat_orchestrator),
) -> dict[str, str]:
    """Clear active conversation history and remembered locations."""
    if session_id:
        cleared = orchestrator.sessions.clear_session(session_id)
        msg = f"Session '{session_id}' cleared." if cleared else f"Session '{session_id}' not found."
    else:
        orchestrator.sessions.clear_all()
        msg = "All chat sessions cleared."
    return {"status": "ok", "message": msg}
