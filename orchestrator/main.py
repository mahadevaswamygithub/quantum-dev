"""
LLM Orchestrator — LangChain + LangGraph + Redis Memory
Port: 8002

Start with:
    uvicorn main:app --port 8002 --reload
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from memory.redis_checkpointer import get_checkpointer
from routers.chat import router as chat_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info(f"  LLM Orchestrator starting")
    logger.info(f"  Provider : {settings.LLM_PROVIDER}")
    logger.info(f"  Redis    : {settings.REDIS_URL}")
    logger.info(f"  Django   : {settings.DJANGO_API_BASE_URL}")
    logger.info("=" * 60)

    # Warm up Redis checkpointer on startup (fail fast if Redis is down)
    get_checkpointer()

    yield

    logger.info("LLM Orchestrator shutting down")


app = FastAPI(
    title="LLM Orchestrator",
    description="LangChain + LangGraph ReAct agent with Redis memory and swappable LLM providers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/chat", tags=["Chat"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "provider": settings.LLM_PROVIDER,
        "redis": settings.REDIS_URL,
    }