# syntax=docker/dockerfile:1
#
# Django backend (repo root: apps/, chat/, corex/).
# Two targets, selected via `target:` in the compose files:
#   dev  — runserver, source bind-mounted from the host, autoreload
#   prod — gunicorn + collected static (WhiteNoise), code baked into the image
#
# Build (usually driven by docker-compose.yml / docker-compose.prod.yml instead):
#   docker build --target dev  -t corex-backend:dev  .
#   docker build --target prod -t corex-backend:prod .

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# libpq-dev/build-essential: psycopg2-binary still needs headers on some
# platforms; libjpeg/zlib: Pillow (ImageField thumbnails etc).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg62-turbo-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/backend-entrypoint.sh \
    && chmod +x /usr/local/bin/backend-entrypoint.sh
ENTRYPOINT ["backend-entrypoint.sh"]

EXPOSE 8000

# ────────────────────────────────────────────────────────────────────────
FROM base AS dev
# Source is bind-mounted over this in docker-compose.yml — COPY here just
# keeps `docker build --target dev` usable standalone (e.g. CI smoke build).
COPY . .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ────────────────────────────────────────────────────────────────────────
FROM base AS prod
COPY . .
# No DB access needed for collectstatic; SECRET_KEY has a default so this
# doesn't require a real .env at build time.
RUN python manage.py collectstatic --noinput
CMD ["gunicorn", "corex.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
