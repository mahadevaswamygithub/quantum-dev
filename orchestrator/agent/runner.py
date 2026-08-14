"""
agent/runner.py
"""

import json
import logging
from typing import AsyncGenerator

from langchain_core.messages import HumanMessage, AIMessage

from agent.graph import build_graph
from memory.redis_checkpointer import make_thread_config
from tools.mcp_tools import get_tools_for_request

logger = logging.getLogger(__name__)


async def run(
    message: str,
    session_id: str,
    user_id: str,
    user_role: str,
    context_headers: dict,
) -> str:
    tools  = await get_tools_for_request(context_headers, user_role)
    graph  = build_graph(tools)
    config = make_thread_config(user_id, session_id)
    result = await graph.ainvoke({"messages": [HumanMessage(content=message)]}, config=config)
    last   = result["messages"][-1]
    return last.content if isinstance(last.content, str) else json.dumps(last.content)


async def run_stream(
    message: str,
    session_id: str,
    user_id: str,
    user_role: str,
    context_headers: dict,
) -> AsyncGenerator[str, None]:
    """
    Streams SSE events. Handles two Ollama behaviours:
      1. Token-by-token via on_chat_model_stream  (streaming models)
      2. Full response via on_chain_end            (non-streaming models)
    """
    try:
        tools  = await get_tools_for_request(context_headers, user_role)
        graph  = build_graph(tools)
        config = make_thread_config(user_id, session_id)

        token_count    = 0
        final_fallback = ""   # used if no tokens were streamed

        print(f"\n[RUNNER] Starting stream for message: {message[:60]!r}")

        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            version="v2",
        ):
            kind = event["event"]
            name = event.get("name", "")
            data = event.get("data", {})

            print(f"[EVENT] {kind} | name={name!r}")

            # ── Tool events ────────────────────────────────────────────────
            if kind == "on_tool_start":
                yield _sse({"type": "tool_start", "tool": name, "input": data.get("input", {})})

            elif kind == "on_tool_end":
                preview = str(data.get("output", ""))[:300]
                yield _sse({"type": "tool_end", "tool": name, "output": preview})

            # ── Streaming tokens (works when Ollama streams) ───────────────
            elif kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk:
                    text = _extract_text(chunk.content)
                    if text:
                        token_count += 1
                        print(f"[TOKEN #{token_count}] {text!r}")
                        yield _sse({"type": "token", "content": text})

            # ── Full message end (fallback for non-streaming Ollama) ───────
            elif kind == "on_chat_model_end":
                output = data.get("output")
                if output and token_count == 0:
                    # No tokens were streamed — send the full content at once
                    text = ""
                    if hasattr(output, "content"):
                        text = _extract_text(output.content)
                    elif isinstance(output, dict):
                        text = _extract_text(output.get("content", ""))

                    if text:
                        print(f"[FALLBACK] Sending full response ({len(text)} chars): {text[:80]!r}")
                        final_fallback = text

            # ── LangGraph node finished — grab final AI message ────────────
            elif kind == "on_chain_end" and name == "agent":
                output = data.get("output", {})
                msgs   = output.get("messages", [])
                if msgs and token_count == 0 and not final_fallback:
                    last = msgs[-1]
                    text = ""
                    if isinstance(last, AIMessage):
                        text = _extract_text(last.content)
                    elif isinstance(last, dict):
                        text = _extract_text(last.get("content", ""))
                    if text:
                        print(f"[CHAIN_END FALLBACK] {text[:80]!r}")
                        final_fallback = text

        # ── Send fallback content if no streaming tokens arrived ───────────
        if final_fallback and token_count == 0:
            print(f"[RUNNER] Emitting fallback response ({len(final_fallback)} chars)")
            # Send in small chunks so React gets incremental updates
            chunk_size = 20
            for i in range(0, len(final_fallback), chunk_size):
                yield _sse({"type": "token", "content": final_fallback[i:i+chunk_size]})

        print(f"[RUNNER] Stream done. tokens={token_count}, fallback_used={token_count==0 and bool(final_fallback)}")
        yield _sse({"type": "done"})

    except Exception as e:
        logger.error(f"Stream error: {e}", exc_info=True)
        print(f"[RUNNER ERROR] {e}")
        yield _sse({"type": "error", "message": str(e)})


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b.get("text", "") if isinstance(b, dict) else str(b)
            for b in content
        )
    return str(content) if content else ""