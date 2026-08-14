# CoreX

Multi-tenant MSP/STP management platform: Django REST backend, React frontend,
and an AI chat assistant built on a FastAPI + LangGraph agent.

## Architecture

```
corex-rct (React, :3000)
   │
   ▼
Django (:8000)  ──apps/tenants, apps/users, chat/──▶ PostgreSQL
   │
   ▼  (chat/ app only, via LLM_ORCHESTRATOR_URL)
orchestrator (:8002)  ── LangGraph agent → LLM (Anthropic/OpenAI/Gemini/Ollama)
   │                                     → tools call Django's REST API directly
   ▼
Django REST API (:8000)
```

The chat assistant forwards one browser JWT end-to-end (Django → orchestrator
→ Django again for tool calls) — there's no separate service-to-service auth
to configure. Only Django is a hard dependency of the main app;
`orchestrator` is only needed for the AI chat assistant feature and fails
gracefully (a friendly error in the chat widget) if it's not running.

| Service | Path | Port | Framework |
|---|---|---|---|
| Backend | repo root (`apps/`, `chat/`, `corex/`) | 8000 | Django + DRF |
| Frontend | `corex-rct/` | 3000 | React (CRA) |
| Orchestrator | `orchestrator/` | 8002 | FastAPI + LangGraph |

## Prerequisites

- Python 3.10
- Node.js + npm
- PostgreSQL, running, with a database created (see `DB_*` below)
- Optional, only for the AI chat assistant:
  - [Ollama](https://ollama.com) running locally (`ollama pull llama3.1 && ollama serve`) — the default, no API key needed — **or** an API key for Anthropic/OpenAI/Gemini
  - Redis, only if you want chat sessions to survive a restart (`orchestrator` works without it, using in-memory sessions)

## 1. Backend (Django)

```bash
venv\Scripts\activate          # create first with: python -m venv venv
pip install -r requirements.txt
```

Create a `.env` in the repo root (all of these have working defaults for local dev — only add what you need to change):

```bash
DB_NAME=corex_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

FRONTEND_URL=http://localhost:3000

# Only needed if you use the "forgot password" / welcome emails:
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=noreply@corex.com
```

Then:

```bash
python manage.py migrate
python manage.py runserver
```

Django is now on `http://localhost:8000`.

Optional — background email/task queue (uses Redis as the broker):

```bash
celery -A corex worker -l info --pool=solo
```

## 2. Frontend (React)

```bash
cd corex-rct
npm install
npm start
```

Runs on `http://localhost:3000`. It talks to Django at
`REACT_APP_API_URL` (see `corex-rct/.env`), defaulting to
`http://127.0.0.1:8000/api` if unset.

## 3. Orchestrator (AI chat assistant)

```bash
cd orchestrator
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8002
```

Defaults to a fully local setup (Ollama, in-memory sessions), and calls
Django's REST API directly for organization/user data — no extra service
needed. See [`orchestrator/README.md`](orchestrator/README.md) to switch LLM
provider or enable Redis-backed sessions.

## Start-up order

Doesn't matter much — nothing crashes if a downstream service isn't up yet,
calls just fail until it is. In practice: **Postgres → Django → everything
else, in any order.**

## Verifying it's all up

```bash
curl http://localhost:8000/api/                      # Django
curl http://localhost:8002/health                     # Orchestrator
```

Then log in to the app at `http://localhost:3000` and open the chat
assistant (bottom-right bubble, hidden for Employee-role users) to exercise
the full chain end-to-end.
