"""
agent/runner.py
"""

import asyncio
import json
import logging
from typing import AsyncGenerator

from langchain_core.messages import HumanMessage, AIMessage

from agent.graph import build_graph
from agent.tool_call_recovery import classify_prefix
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

        # Some local models occasionally write a tool-call-shaped JSON
        # fragment as plain streamed text instead of using real structured
        # tool-calling (see agent/tool_call_recovery.py — graph.py recovers
        # it into a real tool call server-side, but that happens only
        # *after* agent_node's own .astream() loop finishes, and by then
        # astream_events has already fired on_chat_model_stream for every
        # chunk of that garbled attempt). classify_prefix() is checked
        # incrementally per chat-model run (keyed by run_id) so a normal
        # response — which fails the match on its very first character in
        # the overwhelming majority of cases — flushes immediately with no
        # added delay; only a genuine possible match gets buffered for the
        # handful of characters needed to confirm it either way.
        run_buffer: dict[str, str] = {}   # run_id -> buffered prefix, still "maybe"
        run_state:  dict[str, str] = {}   # run_id -> "pass" | "suppressed", once classified

        logger.debug(f"Starting stream for message: {message[:60]!r}")

        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=message)]},
            config=config,
            version="v2",
        ):
            kind   = event["event"]
            name   = event.get("name", "")
            data   = event.get("data", {})
            run_id = event.get("run_id", "")

            # NOTE: this used to `print()` every single event/token here —
            # synchronous console I/O sitting directly in the hot path,
            # executed *before* each yield below, so it was adding real
            # delay to every chunk delivered to the browser (worse on a
            # slow/piped terminal). logger.debug() is effectively free when
            # DEBUG logging isn't enabled (an isEnabledFor check, no I/O).

            # ── Tool events ────────────────────────────────────────────────
            if kind == "on_tool_start":
                yield _sse({"type": "tool_start", "tool": name, "input": data.get("input", {})})

            elif kind == "on_tool_end":
                preview = str(data.get("output", ""))[:300]
                yield _sse({"type": "tool_end", "tool": name, "output": preview})

            # ── Streaming tokens (works when Ollama streams) ───────────────
            elif kind == "on_chat_model_stream":
                if run_state.get(run_id) == "suppressed":
                    continue
                chunk = data.get("chunk")
                if not chunk:
                    continue
                text = _extract_text(chunk.content)
                if not text:
                    continue

                if run_state.get(run_id) != "pass":
                    buf = run_buffer.get(run_id, "") + text
                    verdict = classify_prefix(buf)
                    if verdict == "maybe":
                        run_buffer[run_id] = buf
                        continue
                    run_buffer.pop(run_id, None)
                    if verdict == "match":
                        run_state[run_id] = "suppressed"
                        continue
                    run_state[run_id] = "pass"
                    text = buf   # flush the buffered prefix along with this chunk

                token_count += 1
                yield _sse({"type": "token", "content": text})

            # ── Full message end (fallback for non-streaming Ollama) ───────
            elif kind == "on_chat_model_end":
                # Flush a still-buffered prefix — this run ended while still
                # ambiguous (should be rare: classify_prefix only stays
                # "maybe" for a few characters at most, bounded by the
                # fake-call opening's own length).
                if run_id in run_buffer:
                    buf = run_buffer.pop(run_id)
                    if classify_prefix(buf) == "match":
                        run_state[run_id] = "suppressed"
                    else:
                        run_state[run_id] = "pass"
                        token_count += 1
                        yield _sse({"type": "token", "content": buf})

                output = data.get("output")
                if output and token_count == 0 and run_state.get(run_id) != "suppressed":
                    # No tokens were streamed — send the full content at once
                    text = ""
                    if hasattr(output, "content"):
                        text = _extract_text(output.content)
                    elif isinstance(output, dict):
                        text = _extract_text(output.get("content", ""))

                    if text and classify_prefix(text) != "match":
                        logger.debug(f"Fallback response ready ({len(text)} chars)")
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
                    if text and classify_prefix(text) != "match":
                        final_fallback = text

        # ── Send fallback content if no streaming tokens arrived ───────────
        # Belt-and-suspenders: agent_node now calls the model via .astream()
        # so this shouldn't normally trigger, but some providers/backends
        # still buffer internally despite the streaming interface. A small
        # delay between chunks is what actually makes this render as typing
        # rather than flashing on screen all at once — without it, every
        # chunk gets yielded (and usually arrives at the browser) within the
        # same tick, so it's technically "streamed" but visually instant.
        if final_fallback and token_count == 0:
            logger.debug(f"Emitting fallback response ({len(final_fallback)} chars)")
            chunk_size = 20
            for i in range(0, len(final_fallback), chunk_size):
                yield _sse({"type": "token", "content": final_fallback[i:i+chunk_size]})
                await asyncio.sleep(0.02)

        logger.debug(f"Stream done. tokens={token_count}, fallback_used={token_count==0 and bool(final_fallback)}")
        yield _sse({"type": "done"})

    except Exception as e:
        logger.error(f"Stream error: {e}", exc_info=True)
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