"""
agent/graph.py
──────────────
LangGraph ReAct agent graph.

Flow:
    START → [agent] → tool_calls? → [tools] → [agent] → ... → END
                    → no tools?  → END
"""

import logging
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from agent.tool_call_recovery import recover_fake_tool_call
from llm.factory import get_llm
from memory.redis_checkpointer import get_checkpointer

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a helpful AI assistant for a multi-tenant SaaS platform.
You help admins and users manage their organizations and users.

IMPORTANT RULES:
- For simple greetings (hi, hello, how are you, thanks etc.) — just respond naturally. Do NOT use any tools.
- For questions about organizations or users — use the appropriate tool to fetch real data.
- Never make up data. If you need data, use a tool.
- Be concise and friendly.
- Your tools are read-only (listing/viewing organizations and users). If asked to create, update,
  or delete something, explain that you can't perform that action and point the user to the
  relevant page in the app instead.

Examples of when NOT to use tools:
  "hi" → just say hi back
  "hello" → greet them
  "what can you do?" → explain your capabilities
  "thanks" → respond politely

Examples of when to use tools:
  "list all users" → use list_users tool
  "show my organization" → use get_organization_detail tool
  "who am I logged in as?" → use get_current_user_summary tool
"""


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


def build_graph(tools: list[BaseTool]):
    llm = get_llm()

    # Only bind tools if we have any
    llm_with_tools = llm.bind_tools(tools) if tools else llm

    async def agent_node(state: AgentState) -> AgentState:
        messages = state["messages"]

        # Inject system prompt at the start of every turn
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

        # `.astream()` here (not `.ainvoke()`) is what makes real token
        # streaming happen — LangChain's astream_events only emits
        # per-token `on_chat_model_stream` events when the model is
        # actually invoked in streaming mode. A plain `.ainvoke()` call
        # only ever yields a single `on_chat_model_end` with the full
        # response, so runner.py's astream_events consumer never sees any
        # tokens and falls back to slicing the finished text into fake
        # "chunks" client-side — which is why responses were rendering all
        # at once instead of streaming in. AIMessageChunk supports `+` to
        # accumulate into the final message (including merged tool_calls).
        response = None
        async for chunk in llm_with_tools.astream(messages):
            response = chunk if response is None else response + chunk

        # Small/local models sometimes don't use real structured tool-
        # calling and instead write a tool-call-shaped JSON fragment as
        # plain content (e.g. `{"name": "get_current_user_summary", }`).
        # Recover it into a real tool call so it still actually runs and
        # produces a correct answer, instead of the graph ending on that
        # garbled text as if it were the final response. runner.py
        # separately makes sure the garbled text itself is never shown to
        # the user (see tool_call_recovery.py's docstring).
        if not getattr(response, "tool_calls", None):
            recovered = recover_fake_tool_call(response.content, {t.name for t in tools})
            if recovered:
                logger.warning(f"Recovered malformed tool-call text as a real call: {recovered['name']}")
                response = AIMessage(content="", tool_calls=[recovered])

        logger.info(
            f"LLM response — tool_calls: {len(getattr(response, 'tool_calls', []))}, "
            f"content_length: {len(str(response.content))}"
        )
        return {"messages": [response]}

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)

    if tools:
        graph.add_node("tools", ToolNode(tools))
        graph.set_entry_point("agent")
        # tools_condition: if tool_calls exist → "tools", else → END
        graph.add_conditional_edges("agent", tools_condition)
        graph.add_edge("tools", "agent")
    else:
        # No tools available — agent just responds directly
        graph.set_entry_point("agent")
        graph.add_edge("agent", END)

    checkpointer = get_checkpointer()
    compiled = graph.compile(checkpointer=checkpointer)
    logger.info(f"Graph compiled — tools: {len(tools)}, checkpointer: {type(checkpointer).__name__}")
    return compiled