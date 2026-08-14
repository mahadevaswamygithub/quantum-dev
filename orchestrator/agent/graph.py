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

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import BaseTool
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

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

        response = await llm_with_tools.ainvoke(messages)
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