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
| Frontend | `corex-rct/` | 3000 | React (Vite) |
| Redis | Docker container | 6379 | Celery broker |
| Celery worker | repo root | – | Background tasks (emails) |
| Orchestrator | `orchestrator/` | 8002 | FastAPI + LangGraph |

## Docker

The whole stack (Postgres, Redis, Django, Celery, orchestrator, React) can
run in containers instead of the manual setup below.

```bash
docker compose up --build
```

- Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`,
  Orchestrator: `http://localhost:8002`.
- Source is bind-mounted for all four custom services, so edits on your host
  hot-reload inside the containers same as running them natively.
- Reuses the same root `.env` / `orchestrator/.env` described below —
  `DB_HOST`, `REDIS_URL`, `LLM_ORCHESTRATOR_URL`, `DJANGO_API_BASE_URL` etc.
  are pointed at the Docker service names automatically; everything else
  (email, Razorpay, LLM provider/keys) comes straight from those files.
- The orchestrator's default `LLM_PROVIDER=ollama` expects Ollama running on
  your **host** machine (`ollama serve`) — the container reaches it via
  `host.docker.internal`. Switch to a hosted provider in `orchestrator/.env`
  if you'd rather not run Ollama locally.
- First run creates the Postgres schema automatically (`migrate_schemas`);
  create your first tenant/superuser the same way you would without Docker,
  just prefix with `docker compose exec backend`, e.g.
  `docker compose exec backend python manage.py createsuperuser`.

For a production-style build (gunicorn/uvicorn, no live-reload, nginx serving
the compiled frontend, no source bind mounts):

```bash
cp .env.prod.example .env.prod                              # fill in real secrets
cp orchestrator/.env.prod.example orchestrator/.env.prod     # fill in LLM provider/key
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d
```

Frontend then serves on `http://localhost` (port 80) and proxies `/api` and
`/media` to the backend container itself, so no `REACT_APP_API_URL` juggling
is needed. See the comments at the top of `docker-compose.prod.yml` for what
else differs from the dev compose file.

## Prerequisites

- Python 3.10
- Node.js + npm
- PostgreSQL, running, with a database created (see `DB_*` below)
- Redis + a Celery worker — **required**: creating an organization queues a
  welcome email through Celery, and without Redis that request hangs
  (see [Redis + Celery](#2-redis--celery-background-tasks))
- Docker Desktop (the easiest way to run Redis on Windows)
- Optional, only for the AI chat assistant:
  - [Ollama](https://ollama.com) running locally (`ollama pull llama3.1 && ollama serve`) — the default, no API key needed — **or** an API key for Anthropic/OpenAI/Gemini
  - Redis-backed chat sessions, only if you want them to survive a restart (`orchestrator` works without it, using in-memory sessions)

## 1. Backend (Django)

```bash
venv\Scripts\activate          # create first with: python -m venv venv
pip install -r requirements.txt
```

Create a `.env` in the repo root — start from the template (`copy .env.example .env`)
and generate your own `SECRET_KEY`. Everything else has working defaults for
local dev; only add what you need to change:

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

## 2. Redis + Celery (background tasks)

Django sends emails (e.g. the welcome email when an organization is created)
through a Celery worker, using Redis as the broker. Both must be running, or
you'll see this in the Django/Celery console and the request will hang:

```
Connection to Redis lost: Retry (0/20) now.
```

**Start Redis** (Docker — Redis has no native Windows build):

```bash
docker run -d --name corex-redis -p 6379:6379 redis:7-alpine   # first time
docker start corex-redis                                        # every time after
```

> The `redis` service in `docker-compose.yml` is only for the full Docker
> stack — its host port is commented out, so a natively-run Django can't
> reach it. Use the container above instead.

**Start the Celery worker** (second terminal, repo root):

```bash
venv\Scripts\activate
celery -A corex worker -l info -P solo
```

`-P solo` is required on Windows — Celery's default pool doesn't work there.

**Start Celery beat** (third terminal, repo root) — runs scheduled jobs, such
as cancelling unpaid bookings once their payment window
(`BOOKING_PAYMENT_WINDOW_MINUTES`, default 15) has passed:

```bash
venv\Scripts\activate
celery -A corex beat -l info
```

Room availability never depends on beat having run — a stale unpaid booking
stops blocking the room as soon as its window passes — beat just keeps the
statuses shown to staff and customers up to date.

Django reads the broker from `REDIS_URL` (default `redis://localhost:6379/0`).

## 3. Frontend (React + Vite)

```bash
cd corex-rct
npm install
npm start
```

Runs on `http://localhost:3000`. It talks to Django at `VITE_API_URL`
(or the older `REACT_APP_API_URL`; see `corex-rct/.env`), defaulting to
`http://127.0.0.1:8000/api` if unset.

Other scripts: `npm run build` (production build into `build/`) and
`npm test` (Vitest).

## 4. Orchestrator (AI chat assistant)

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
calls just fail until it is. In practice: **Postgres + Redis → Django +
Celery worker → everything else, in any order.**

Day-to-day, that's five terminals:

| # | Command | From |
|---|---|---|
| 1 | `docker start corex-redis` | anywhere |
| 2 | `python manage.py runserver` | repo root (venv active) |
| 3 | `celery -A corex worker -l info -P solo` | repo root (venv active) |
| 4 | `celery -A corex beat -l info` | repo root (venv active) |
| 5 | `npm start` | `corex-rct/` |

Plus `uvicorn main:app --reload --port 8002` in `orchestrator/` if you need
the AI chat assistant.

## Verifying it's all up

```bash
curl http://localhost:8000/api/                      # Django
docker exec corex-redis redis-cli ping                # Redis → PONG
curl http://localhost:8002/health                     # Orchestrator
```

The Celery terminal should show `celery@<host> ready.` and no
"Connection to Redis lost" lines.

Then log in to the app at `http://localhost:3000` and open the chat
assistant (bottom-right bubble, hidden for Employee-role users) to exercise
the full chain end-to-end.
