"""
Chat API endpoints.

POST   /chat/message                  → standard response
POST   /chat/stream                   → SSE streaming
GET    /chat/sessions/{id}/history    → fetch Redis memory for a session
DELETE /chat/sessions/{id}            → clear session memory from Redis
GET    /chat/providers                → which LLMs are configured
"""

import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.runner import run, run_stream
from memory.redis_checkpointer import get_session_messages, delete_session
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str        # Current user message (history is in Redis — no need to send it)
    session_id: str     # Identifies the conversation thread


class ChatResponse(BaseModel):
    success: bool
    response: str
    session_id: str
    provider: str


# ── Context extraction ────────────────────────────────────────────────────────

class RequestContext:
    """Extracts tenant context from headers — forwarded from Django."""

    def __init__(
        self,
        x_tenant_id: str = Header(..., alias="X-Tenant-ID"),
        x_user_id: str = Header(..., alias="X-User-ID"),
        x_user_role: str = Header(..., alias="X-User-Role"),
        authorization: str = Header(...),
    ):
        self.tenant_id = x_tenant_id
        self.user_id = x_user_id
        self.user_role = x_user_role
        self.authorization = authorization

    @property
    def mcp_headers(self) -> dict:
        """Headers forwarded to MCP Tool Server for every tool call."""
        return {
            "X-Tenant-ID": self.tenant_id,
            "X-User-ID": self.user_id,
            "X-User-Role": self.user_role,
            "Authorization": self.authorization,
            "Content-Type": "application/json",
        }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/message", response_model=ChatResponse)
async def chat_message(body: ChatRequest, ctx: RequestContext = Depends()):
    """
    Standard chat. Django calls this and waits for the full answer.
    No need to pass history — it's loaded from Redis automatically.
    """
    response_text = await run(
        message=body.message,
        session_id=body.session_id,
        user_id=ctx.user_id,
        user_role=ctx.user_role,
        context_headers=ctx.mcp_headers,
    )
    return ChatResponse(
        success=True,
        response=response_text,
        session_id=body.session_id,
        provider=settings.LLM_PROVIDER,
    )


@router.post("/stream")
async def chat_stream(body: ChatRequest, ctx: RequestContext = Depends()):
    """
    SSE streaming. React connects to this directly for real-time tokens.

    Events:
      data: {"type": "tool_start", "tool": "list_users",  "input": {...}}
      data: {"type": "tool_end",   "tool": "list_users",  "output": "..."}
      data: {"type": "token",      "content": "Here are your users..."}
      data: {"type": "done"}
      data: {"type": "error",      "message": "..."}
    """
    return StreamingResponse(
        run_stream(
            message=body.message,
            session_id=body.session_id,
            user_id=ctx.user_id,
            user_role=ctx.user_role,
            context_headers=ctx.mcp_headers,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",      # disable nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/sessions/{session_id}/history")
async def get_history(session_id: str, ctx: RequestContext = Depends()):
    """Returns stored messages for a session from Redis."""
    messages = await get_session_messages(ctx.user_id, session_id)
    return {"session_id": session_id, "messages": messages}


@router.delete("/sessions/{session_id}")
async def clear_session(session_id: str, ctx: RequestContext = Depends()):
    """Deletes all memory for a session from Redis."""
    ok = await delete_session(ctx.user_id, session_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not clear session")
    return {"success": True, "message": f"Session {session_id} cleared"}


@router.get("/providers")
async def list_providers():
    """Shows which LLM is active and what's available."""
    return {
        "active_provider": settings.LLM_PROVIDER,
        "active_model": {
            "anthropic": settings.ANTHROPIC_MODEL,
            "openai":    settings.OPENAI_MODEL,
            "gemini":    settings.GEMINI_MODEL,
            "ollama":    settings.OLLAMA_MODEL,
        }.get(settings.LLM_PROVIDER),
        "available_providers": ["anthropic", "openai", "gemini", "ollama"],
    }