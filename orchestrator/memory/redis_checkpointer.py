"""
memory/redis_checkpointer.py
─────────────────────────────
Provides a LangGraph checkpointer.

Strategy:
  1. Try Redis (AsyncRedisSaver) for persistent memory across restarts
  2. Fall back to InMemorySaver if Redis is unavailable

IMPORTANT: AsyncRedisSaver must be used as an async context manager
           in the graph — we handle this by initialising it at startup
           and storing the live instance on app state.
           For simplicity we use InMemorySaver which works out of the box.
           Upgrade to Redis by setting MEMORY_BACKEND=redis in .env.
"""

import logging
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import MemorySaver

from config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — set once at startup
_checkpointer = None


def init_checkpointer():
    """
    Call this ONCE at app startup (in lifespan).
    Returns the checkpointer instance and stores it as singleton.
    """
    global _checkpointer

    if settings.MEMORY_BACKEND == "redis":
        try:
            # Redis sync saver — works without async context manager issues
            from langgraph.checkpoint.redis import RedisSaver
            saver = RedisSaver.from_conn_string(settings.REDIS_URL)
            saver.setup()   # creates Redis key structure
            _checkpointer = saver
            logger.info(f"Redis checkpointer connected → {settings.REDIS_URL}")
            return _checkpointer
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}) — falling back to InMemorySaver")

    # Default: in-memory (works always, no extra dependencies)
    _checkpointer = MemorySaver()
    logger.info("Using InMemorySaver (sessions lost on restart)")
    return _checkpointer


def get_checkpointer():
    """Returns the singleton checkpointer. Must call init_checkpointer() first."""
    global _checkpointer
    if _checkpointer is None:
        # Auto-init if not done yet (safety net)
        init_checkpointer()
    return _checkpointer


def make_thread_config(user_id: str, session_id: str) -> RunnableConfig:
    """
    Scopes memory to a specific user + session.
    Pass as `config` to graph.ainvoke() / graph.astream_events().
    """
    return {
        "configurable": {
            "thread_id": f"{user_id}:{session_id}",
        }
    }


def get_session_messages(user_id: str, session_id: str) -> list[dict]:
    """
    Reads stored messages from checkpointer for a session.
    Returns list of {"role": ..., "content": ...} dicts.
    """
    from langchain_core.messages import AIMessage, HumanMessage

    checkpointer = get_checkpointer()
    config = make_thread_config(user_id, session_id)

    try:
        snapshot = checkpointer.get(config)
        if not snapshot:
            return []

        messages = []
        for msg in snapshot["channel_values"].get("messages", []):
            if isinstance(msg, HumanMessage):
                messages.append({"role": "user", "content": str(msg.content)})
            elif isinstance(msg, AIMessage):
                if isinstance(msg.content, str) and msg.content.strip():
                    messages.append({"role": "assistant", "content": msg.content})
        return messages

    except Exception as e:
        logger.error(f"Failed to read session [{session_id}]: {e}")
        return []


def delete_session(user_id: str, session_id: str) -> bool:
    """Clears memory for a session."""
    checkpointer = get_checkpointer()
    config = make_thread_config(user_id, session_id)
    try:
        # MemorySaver and RedisSaver both support .delete()
        checkpointer.delete(config)
        return True
    except Exception as e:
        logger.error(f"Failed to delete session [{session_id}]: {e}")
        return False