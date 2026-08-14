"""
LLM Factory — one function, any provider.

Usage:
    from llm.factory import get_llm

    llm = get_llm()            # reads LLM_PROVIDER from .env
    llm = get_llm("openai")    # override at runtime

All returned models are LangChain BaseChatModel and support:
    .invoke()  /  .ainvoke()  /  .stream()  /  .astream()  /  .bind_tools()
"""

import logging
from langchain_core.language_models import BaseChatModel
from config import settings

logger = logging.getLogger(__name__)


def get_llm(provider: str | None = None) -> BaseChatModel:
    provider = provider or settings.LLM_PROVIDER
    logger.info(f"Loading LLM provider → {provider}")

    match provider:
        case "anthropic": return _anthropic()
        case "openai":    return _openai()
        case "gemini":    return _gemini()
        case "ollama":    return _ollama()
        case _:
            raise ValueError(
                f"Unknown provider '{provider}'. "
                "Choose: anthropic | openai | gemini | ollama"
            )


# ── Provider builders ─────────────────────────────────────────────────────────

def _anthropic() -> BaseChatModel:
    from langchain_anthropic import ChatAnthropic
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set in .env")
    return ChatAnthropic(
        model=settings.ANTHROPIC_MODEL,
        api_key=settings.ANTHROPIC_API_KEY,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
    )


def _openai() -> BaseChatModel:
    from langchain_openai import ChatOpenAI
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set in .env")
    return ChatOpenAI(
        model=settings.OPENAI_MODEL,
        api_key=settings.OPENAI_API_KEY,
        temperature=settings.LLM_TEMPERATURE,
        max_tokens=settings.LLM_MAX_TOKENS,
    )


def _gemini() -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI
    if not settings.GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY is not set in .env")
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=settings.LLM_TEMPERATURE,
        max_output_tokens=settings.LLM_MAX_TOKENS,
    )


def _ollama() -> BaseChatModel:
    from langchain_ollama import ChatOllama
    # No API key needed — Ollama runs locally
    return ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=settings.LLM_TEMPERATURE,
    )