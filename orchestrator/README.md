# Orchestrator

A FastAPI + [LangGraph](https://langchain-ai.github.io/langgraph/) ReAct
agent that powers the AI chat assistant. Its tools (`tools/mcp_tools.py`)
call Django's REST API directly to fetch organization/user data.

```
React → Django (chat/) → orchestrator (this) → Django REST API
```

(There used to be a separate `mcp_tool_server` relay between this service and
Django. It only forwarded requests and added a tool-schema lookup with no
other logic, so it was folded directly into `tools/mcp_tools.py` — one fewer
process to run, same behavior.)

## What it does

- `routers/chat.py` exposes:
  - `POST /chat/message` — non-streaming reply
  - `POST /chat/stream` — SSE streaming (`tool_start` / `tool_end` / `token` / `done` / `error` events)
  - `GET /chat/sessions/{session_id}/history`
  - `DELETE /chat/sessions/{session_id}`
  - `GET /chat/providers` — which LLM provider/model is active, and what's available
- `agent/graph.py` — the LangGraph ReAct loop (agent ⇄ tools) with the system prompt.
- `agent/runner.py` — builds this request's role-filtered tools, invokes/streams the graph.
- `tools/mcp_tools.py` — the 5 read-only tools (`list_organizations`,
  `get_organization_detail`, `list_users`, `get_user_detail`,
  `get_current_user_summary`), each calling Django's REST API directly,
  role-gated via `ROLE_PERMISSIONS`.
- `llm/factory.py` — swaps between Anthropic / OpenAI / Gemini / local Ollama based on `LLM_PROVIDER`.
- `memory/redis_checkpointer.py` — conversation memory. Redis is optional: if
  `MEMORY_BACKEND=redis` and Redis is unreachable, it logs a warning and
  silently falls back to an in-process `MemorySaver` (sessions lost on restart).

Auth is a pass-through: the browser's JWT and tenant headers
(`Authorization`, `X-Tenant-ID`, `X-User-ID`, `X-User-Role`) arrive from
Django's `chat/` app and are forwarded to Django's REST API on every tool
call. This service never validates the token itself — only Django does.

## Configuration

All in `.env`:

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | `anthropic` \| `openai` \| `gemini` \| `ollama` — which LLM to use |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY` | *(empty)* | Required only for the matching provider |
| `ANTHROPIC_MODEL` / `OPENAI_MODEL` / `GEMINI_MODEL` / `OLLAMA_MODEL` | see `config.py` | Model name per provider |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Only used when `LLM_PROVIDER=ollama` — needs a local Ollama server running |
| `LLM_TEMPERATURE` / `LLM_MAX_TOKENS` | `0.0` / `2048` | LLM call tuning |
| `MEMORY_BACKEND` | `memory` | `memory` (default, no setup) or `redis` (persistent, needs Redis) |
| `REDIS_URL` | `redis://localhost:6379` | Only used when `MEMORY_BACKEND=redis` |
| `DJANGO_API_BASE_URL` | `http://127.0.0.1:8000` | Where to reach Django's REST API for tool calls |

The default `.env` in this repo runs fully local with zero external accounts:
`LLM_PROVIDER=ollama` + `MEMORY_BACKEND=memory` — the only thing you need
running is [Ollama](https://ollama.com) itself (`ollama pull llama3.1`, then
`ollama serve`). Switch to a hosted provider by setting `LLM_PROVIDER` and
its API key.

## Running standalone

```bash
cd orchestrator
python -m venv venv
venv\Scripts\activate          # Windows; use `source venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

Requires Django running on port 8000 for tool calls to work (the agent still
boots and replies to plain messages without it — tool calls just return an
error until Django is reachable).

Health check: `GET http://localhost:8002/health`

For the full stack (Django + this + React), see the [root README](../README.md).
