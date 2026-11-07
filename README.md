# CoreX

Multi-tenant MSP/STP management platform: Django REST backend, React frontend,
and an AI chat assistant built on a FastAPI + LangGraph agent.

## Production quick start

What to do after deploying to a server. Details: [Customer accounts](#customer-accounts),
[Production checklist](#production-checklist-reliability), [k8s/README.md](k8s/README.md).

### 1. Deploy

| How | Command |
|---|---|
| Docker Compose | `cp .env.prod.example .env.prod` (fill it in), then `docker compose -f docker-compose.prod.yml --env-file .env.prod up --build -d` |
| Kubernetes | fill in `k8s/overlays/production/secrets/*.env` and the domain, then `k8s/deploy.sh k8s/overlays/production` |

Database migrations run by themselves (the backend container at start-up; on
Kubernetes, the `corex-migrate` job, which new pods wait for). Existing
organizations become **Active** with no hotel limit.

### 2. Create the platform owner account (once)

The platform owner (role `PLATFORM_ADMIN`) runs the **Customers** console at
`/platform`: approves sign-ups, suspends or closes accounts, sets hotel limits.
Run this on the production backend:

```bash
# Docker Compose (on the server, in the project folder)
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py create_platform_admin --email ops@your-domain.com --first-name Ops --last-name Team

# Kubernetes (kubectl pointed at the cluster)
kubectl -n corex exec deploy/backend -- \
  python manage.py create_platform_admin --email ops@your-domain.com --first-name Ops --last-name Team
```

It emails a set-password link. Add `--print-link` to also print it, if email
isn't working yet. Then sign in at `https://your-domain.com/login`, set up
two-step verification (required for this role) and you land on **Customers**.

- `Unknown command: 'create_platform_admin'` means the server runs an older
  version: deploy the latest code first.
- Use a mailbox someone reads (sign-up alerts and password resets go there),
  not the no-reply sending address.
- One account per person (the activity log shows who approved or suspended
  what), and keep the number small: this role can suspend any customer.

### 3. Email

Every invite, approval, password reset and booking email depends on it.

- **Don't use Gmail in production**: about 500 emails a day, often lands in
  spam, and a password change on the Gmail account stops all mail. For testing
  it needs a 16-letter app password (Google account → Security → 2-Step
  Verification on → App passwords), not the account password.
- Use a transactional email service: **Amazon SES** (cheapest), SendGrid,
  Brevo, Postmark or Mailgun. Send from your own domain and add the SPF, DKIM
  and DMARC DNS records the provider gives you.

```
EMAIL_HOST=email-smtp.ap-south-1.amazonaws.com   # SES example
EMAIL_PORT=587
EMAIL_HOST_USER=<from the provider>
EMAIL_HOST_PASSWORD=<from the provider>
DEFAULT_FROM_EMAIL=CoreX <no-reply@your-domain.com>
FRONTEND_URL=https://your-domain.com             # links in emails use it
```

Put them in `.env.prod` (Docker Compose) or
`k8s/overlays/production/secrets/backend.env` (Kubernetes); both are
git-ignored. After a change: `docker compose -f docker-compose.prod.yml up -d`
(a plain `restart` doesn't re-read the file) or `k8s/deploy.sh` again.
Test it with "Forgot password" on the login page.

### 4. Hotel sign-up

| Setting | Recommendation |
|---|---|
| `ALLOW_PUBLIC_ORG_SIGNUP` | `False` until email works and someone watches the approval queue, then `True` (hotels sign up at `/register`) |
| `SIGNUP_PROPERTY_LIMIT` | Hotels a new sign-up gets until you raise it (default 3) |
| `TWO_FACTOR_REQUIRED_ROLES` | Leave it out: the default requires two-step verification for MSP admins and the platform owner |

Docker Compose: in `.env.prod`. Kubernetes: in `corex-config` in
`k8s/overlays/production/kustomization.yaml`.

### 5. Kubernetes notes

- The cluster needs ingress-nginx, cert-manager (`letsencrypt-prod`
  ClusterIssuer) and metrics-server; use a managed Postgres and an S3 bucket
  (`USE_S3=True`).
- Deploy an image tag per release (the git commit SHA built by
  `.github/workflows/images.yml`), not `latest`, so a rollback is the previous
  tag plus `k8s/deploy.sh`.
- Run any management command with
  `kubectl -n corex exec deploy/backend -- python manage.py <command>`.
- Logs: `kubectl -n corex logs deploy/backend --tail=100`. Health:
  `curl https://your-domain.com/api/health/ready/`.
- The orchestrator (AI chat) is internal only; never expose port 8002.
- Try the whole thing locally on Docker Desktop: `k8s/overlays/local` (see
  [k8s/README.md](k8s/README.md)).

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

**Guest assistant (booking site).** Guests on `/book` get a separate chat
helper (`POST /api/bookings/assistant/`, open to logged-out visitors). It never
uses the orchestrator — that agent has staff tools. Common questions (find
stays, live availability, my bookings, check-in/payment/cancellation/contact)
are answered instantly from the database; anything else goes straight to a
local Ollama model with public facts only and no tools. Needs `ollama serve`
with the model in `GUEST_ASSISTANT_MODEL` pulled (`ollama pull llama3.2`);
without it the helper still works and shows its menu for unknown questions.

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

### Kubernetes

For several servers, autoscaling and zero-downtime deploys, see
[k8s/README.md](k8s/README.md) (Kustomize manifests for production and for
Docker Desktop's local cluster).

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

## Customer accounts

```
Platform owner (PLATFORM_ADMIN, /platform)   approves, suspends, sets hotel limits
 ├── STP  "Green Stays"   most customers: one business, hotels are Properties inside it
 └── MSP  "Taj Group"     optional: a group whose hotels are separate STPs, each with its own manager
```

- **Create the platform owner** (once per installation):
  `python manage.py create_platform_admin --email you@corex.com --first-name Asha --print-link`
  The account sets its password from the link and must turn on two-step verification.
- **Onboarding:** the platform owner creates customers from **Customers → New customer** (active at once),
  or, with `ALLOW_PUBLIC_ORG_SIGNUP=True`, hotels sign up at `/register`. Sign-ups are **pending**: they can
  sign in and set up, but guests can't see them until the platform owner approves.
- **Status:** pending → active → suspended / closed. Suspended or closed accounts are signed out at once,
  can't sign in, and disappear from the booking site; their bookings are kept.
- **Hotel limit:** per customer (MSP: its STP hotels; single business: its properties).
  Sign-ups start at `SIGNUP_PROPERTY_LIMIT`.

## Production checklist (reliability)

Run `python manage.py check --deploy` on the server: it warns about anything below that's missing.

| Setting (`.env.prod`) | Why |
|---|---|
| `CACHE_USE_REDIS=True` | Login lockouts and rate limits shared by every server |
| `USE_S3=True` + `S3_*` | Uploads in object storage (AWS S3, Cloudflare R2, Wasabi, MinIO) so 2+ servers see the same files |
| `BOOKING_EMAILS_VIA_CELERY=True` | Booking emails sent by the Celery worker with retries (falls back to in-process if Redis is down) |
| `SENTRY_DSN` | Error tracking; every error is tagged with the request's `X-Request-ID` |
| `LOG_FORMAT=json` | One JSON log line per event, each with `request_id` |

Run **one** `celery-beat` (scheduler) and one or more `celery` workers; `docker-compose.prod.yml` includes both.

Health checks for load balancers / uptime monitors:
- `GET /api/health/`: the process is up.
- `GET /api/health/ready/`: database, cache and storage answer (503 if not).

Every response carries `X-Request-ID`; ask customers to quote it in support tickets, then search logs/Sentry for it.

CI (`.github/workflows/ci.yml`) runs lint, migrations check, backend tests on Postgres, and frontend tests + build on every push and pull request.

Load testing: see `loadtests/locustfile.py` (Locust). Run it against a staging copy, never production without notice.
