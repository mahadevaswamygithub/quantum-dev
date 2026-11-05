# syntax=docker/dockerfile:1
#
# FastAPI + LangGraph orchestrator (AI chat assistant). Build context is
# orchestrator/ itself (see docker-compose.yml: build.context: ./orchestrator).
#
#   dev  — uvicorn --reload, source bind-mounted, autoreload
#   prod — uvicorn without --reload, code baked into the image

FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

EXPOSE 8002

# ────────────────────────────────────────────────────────────────────────
FROM base AS dev
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]

# ────────────────────────────────────────────────────────────────────────
FROM base AS prod
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]
