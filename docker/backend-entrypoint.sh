#!/bin/sh
# Entrypoint shared by the backend (dev+prod) and celery images — CMD differs
# per service, this just makes sure Postgres is reachable and schemas are
# migrated before handing off.
set -e

if [ -n "$DB_HOST" ]; then
    echo "backend-entrypoint: waiting for Postgres at ${DB_HOST}:${DB_PORT:-5432}..."
    python - <<'PY'
import os
import socket
import time

host = os.environ.get("DB_HOST", "localhost")
port = int(os.environ.get("DB_PORT", "5432"))

for _ in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit(f"Postgres at {host}:{port} never became reachable")
PY
    echo "backend-entrypoint: Postgres is up."
fi

# The celery service reuses this image/entrypoint and sets SKIP_MIGRATE=1 so
# only the backend container (which starts first per depends_on) migrates —
# running migrate_schemas from two containers at once races.
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
    echo "backend-entrypoint: applying migrations (migrate_schemas)..."
    python manage.py migrate_schemas --noinput

    # On a brand-new database there's no Domain row yet, so django-tenants
    # 404s every /api/ request (no CORS headers on that 404 either, which
    # browsers surface as a misleading "CORS error"). Idempotent — safe on
    # every startup, not just the first.
    #
    # Two rows: the public-facing hostname (what the browser uses) and
    # "backend" (what the orchestrator's server-to-server tool calls use —
    # DJANGO_API_BASE_URL=http://backend:8000 — same server, different Host
    # header, so it needs its own Domain row).
    echo "backend-entrypoint: ensuring public tenant/domain exist..."
    python manage.py bootstrap_public_tenant --domain "${PUBLIC_TENANT_DOMAIN:-localhost}" --domain backend
fi

exec "$@"
