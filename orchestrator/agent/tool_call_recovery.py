"""
agent/tool_call_recovery.py
────────────────────────────
Some local/small models (this project defaults to Ollama) don't reliably
use their provider's real structured tool-calling — instead of producing
a proper `tool_calls` entry, they sometimes just write a tool-call-shaped
JSON fragment as plain text content, e.g.:

    {"name": "get_current_user_summary", }

(often malformed/truncated — note the dangling trailing comma above, with
no "arguments" key at all). Left alone, that garbled fragment streams
straight to the user as if it were the actual answer.

Two garbled shapes are recognized:
  - `{"name": "...", ...}` — an attempted (often malformed/truncated) tool
    call written as plain text instead of real structured tool-calling.
    Recoverable — see recover_fake_tool_call() below.
  - `{}` — a bare empty object with no "name" at all. Not recoverable into
    anything (there's no tool name to run), so this one just needs to never
    reach the user as literal "{}" — graph.py swaps in a plain-text fallback
    reply instead (see agent_node's use of classify_prefix()).

Two call sites need to agree on what these patterns look like:
  - runner.py   — must never forward either as visible token text.
  - graph.py    — must convert the first into a real tool call so the tool
                  actually runs, and replace the second with real reply text.
This module is the one shared place that defines both, so both stay in sync.
"""

import json
import re
import uuid

# The garbled shapes' openings, with insignificant JSON whitespace stripped
# out for comparison — see classify_prefix(). `_EMPTY_OBJECT` doubles as its
# own complete shape (an empty object is never itself a valid, useful reply).
_TARGET = '{"name":"'
_EMPTY_OBJECT = "{}"

# Full match against the *complete* content — requires the name's closing
# quote, used once we have the whole (possibly still malformed) fragment.
_NAME_RE = re.compile(r'^\s*\{\s*"name"\s*:\s*"([a-zA-Z_][a-zA-Z0-9_]*)"')


def _prefix_verdict(stripped: str, target: str) -> str:
    n = min(len(stripped), len(target))
    if stripped[:n] != target[:n]:
        return "no"
    return "match" if len(stripped) >= len(target) else "maybe"


def classify_prefix(buf: str) -> str:
    """Incrementally classifies a *streaming* prefix against the known
    garbled-JSON shapes, character by character, so a normal response can be
    flushed to the user immediately instead of waiting for some fixed
    number of characters every single time (that flat-wait approach was
    the previous version of this module — it added real, noticeable delay
    to *every* response, most painfully on short ones, since almost the
    whole reply sat buffered).

    Returns:
      "no"    — definitely not a match, safe to flush `buf` right now.
                For a normal response this is almost always the verdict
                on the very first character (`buf[0] != '{'`), so there's
                no added latency for the overwhelming majority of replies.
      "maybe" — still a possible prefix of *some* known shape, need more
                characters before deciding (bounded by the longest target
                — always resolves within a handful of characters, never
                grows unbounded).
      "match" — one of the known shapes is fully present; the run should
                be suppressed.
    """
    stripped = re.sub(r"\s+", "", buf)
    verdicts = [_prefix_verdict(stripped, t) for t in (_TARGET, _EMPTY_OBJECT)]
    if "match" in verdicts:
        return "match"
    if "maybe" in verdicts:
        return "maybe"
    return "no"


def recover_fake_tool_call(content: str, tool_names: set[str]) -> dict | None:
    """Best-effort: pull the tool name (and args, if present/parseable)
    out of a garbled tool-call-shaped text response. Returns a LangChain
    ToolCall dict, or None if it doesn't look recoverable — e.g. the name
    isn't one of this request's actual allowed tools."""
    if not isinstance(content, str):
        return None
    m = _NAME_RE.match(content)
    if not m or m.group(1) not in tool_names:
        return None

    args = {}
    args_match = re.search(r'"(?:arguments|parameters|args)"\s*:\s*(\{.*?\})', content, re.DOTALL)
    if args_match:
        try:
            args = json.loads(args_match.group(1))
        except Exception:
            args = {}

    return {"name": m.group(1), "args": args, "id": f"recovered-{uuid.uuid4().hex[:8]}", "type": "tool_call"}
