from typing import Literal
from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    # ── Active LLM ──────────────────────────────────────────────────────────
    # Change this ONE value to swap LLMs: anthropic | openai | gemini | ollama
    LLM_PROVIDER: Literal["anthropic", "openai", "gemini", "ollama"] = "ollama"

    # ── API Keys ─────────────────────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # ── Model names ───────────────────────────────────────────────────────────
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    OPENAI_MODEL: str = "gpt-4o"
    GEMINI_MODEL: str = "gemini-1.5-pro"
    OLLAMA_MODEL: str = "llama3.1"
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # ── LLM tuning ────────────────────────────────────────────────────────────
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: int = 2048

    # ── Memory backend ────────────────────────────────────────────────────────
    # "memory" = InMemorySaver (default, works out of the box, lost on restart)
    # "redis"  = RedisSaver    (persistent, requires Redis running)
    MEMORY_BACKEND: Literal["memory", "redis"] = "memory"
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_TTL_SECONDS: int = 60 * 60 * 24 * 7   # 7 days

    # ── Downstream services ───────────────────────────────────────────────────
    DJANGO_API_BASE_URL: str = "http://127.0.0.1:8000"

    class Config:
        env_file = ".env"


settings = Settings()