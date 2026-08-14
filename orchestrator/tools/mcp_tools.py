"""
tools/mcp_tools.py
───────────────────
Tool definitions + Django-calling logic for the agent's tools.

The LLM calls these tools directly; each one hits Django's REST API with the
same JWT the browser sent, so results are already correctly tenant/role-scoped
by Django itself.

(There used to be a standalone "mcp_tool_server" relay between this service
and Django — it added a network hop for zero actual logic beyond this same
role-based tool list, so it was folded in here instead.)
"""

import json
import logging
from typing import Any, Type

import httpx
from pydantic import BaseModel, Field, create_model
from langchain_core.tools import StructuredTool

from config import settings

logger = logging.getLogger(__name__)

# ── Tool schemas (JSON Schema "properties"/"required", same shape the LLM sees) ──
TOOL_SCHEMAS: dict[str, dict] = {
    "list_organizations": {
        "description": (
            "List organizations visible to the current user. "
            "GREEN_ADMIN sees all tenants. MSP_ADMIN sees their org and sub-orgs. "
            "STP roles see only their own organization."
        ),
        "properties": {
            "tenant_type": {"type": "string", "enum": ["MSP", "STP"], "description": "Filter by organization type"},
            "is_active": {"type": "boolean", "description": "Filter by active/inactive status"},
            "search": {"type": "string", "description": "Search by organization name"},
        },
        "required": [],
    },
    "get_organization_detail": {
        "description": "Get full details of a specific organization including sub-organizations and user count.",
        "properties": {"organization_id": {"type": "integer", "description": "Organization primary key (ID)"}},
        "required": ["organization_id"],
    },
    "list_users": {
        "description": (
            "List users scoped to the current tenant. "
            "GREEN_ADMIN sees all users. MSP_ADMIN sees their org and sub-org users. "
            "STP roles see only users in their own org."
        ),
        "properties": {
            "role": {"type": "string", "enum": ["GREEN_ADMIN", "MSP_ADMIN", "MSP_USER", "STP_ADMIN", "STP_USER"], "description": "Filter by user role"},
            "is_active": {"type": "boolean", "description": "Filter by active status"},
            "search": {"type": "string", "description": "Search by name or email"},
            "organization_id": {"type": "integer", "description": "Filter by organization (admin roles only)"},
        },
        "required": [],
    },
    "get_user_detail": {
        "description": "Get detailed information about a specific user by their ID.",
        "properties": {"user_id": {"type": "integer", "description": "User primary key (ID)"}},
        "required": ["user_id"],
    },
    "get_current_user_summary": {
        "description": "Get a summary of the currently authenticated user: their name, email, role, and organization.",
        "properties": {},
        "required": [],
    },
}

# ── Role → allowed tool names ─────────────────────────────────────────────────
# NOTE: "GREEN_ADMIN" isn't one of Django's actual User.ROLE_CHOICES
# (MSP_ADMIN/MSP_USER/STP_ADMIN/STP_USER/EMPLOYEE) — carried over unchanged
# from the old mcp_tool_server registry; harmless dead branch today (no user
# ever has that role) but flagging it here in case it's meant to be wired up.
ROLE_PERMISSIONS: dict[str, list | str] = {
    "GREEN_ADMIN": "*",
    "MSP_ADMIN": ["list_organizations", "get_organization_detail", "list_users", "get_user_detail", "get_current_user_summary"],
    "MSP_USER": ["list_organizations", "get_organization_detail", "list_users", "get_user_detail", "get_current_user_summary"],
    "STP_ADMIN": ["get_organization_detail", "list_users", "get_user_detail", "get_current_user_summary"],
    "STP_USER": ["get_current_user_summary"],
}


def _allowed_tool_names(role: str) -> list[str]:
    allowed = ROLE_PERMISSIONS.get(role, [])
    return list(TOOL_SCHEMAS.keys()) if allowed == "*" else allowed


# ── Django REST calls (one per tool) ──────────────────────────────────────────

def _auth_error_payload(e: httpx.HTTPStatusError) -> dict:
    if e.response.status_code == 401:
        return {"error": "Authentication failed — JWT token may be expired. Please log in again.", "status_code": 401}
    if e.response.status_code == 403:
        return {"error": "Permission denied — your role does not have access to this resource.", "status_code": 403}
    return {"error": f"Django API error: {e.response.text[:300]}", "status_code": e.response.status_code}


async def _django_get(path: str, headers: dict, params: dict = None) -> dict:
    """GET request to Django's REST API with the forwarded JWT + tenant headers."""
    url = f"{settings.DJANGO_API_BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            r = await client.get(url, headers=headers, params=params or {})
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"[tools→Django] {e.response.status_code} on GET {url}: {e.response.text[:200]}")
            return _auth_error_payload(e)
        except Exception as e:
            logger.error(f"[tools→Django] error on GET {url}: {e}")
            return {"error": str(e)}


async def _list_organizations(headers, tenant_type=None, is_active=None, search=None, **_) -> dict:
    params = {k: v for k, v in {"tenant_type": tenant_type, "is_active": is_active, "search": search}.items() if v is not None}
    data = await _django_get("/api/tenants/organizations/", headers, params)
    if "error" in data:
        return data
    orgs = data.get("results", data) if isinstance(data, dict) else data
    return {"success": True, "organizations": orgs, "count": data.get("count", len(orgs)) if isinstance(data, dict) else len(orgs)}


async def _get_organization_detail(headers, organization_id=None, **_) -> dict:
    data = await _django_get(f"/api/tenants/organizations/{organization_id}/", headers)
    return data if "error" in data else {"success": True, "organization": data}


async def _list_users(headers, role=None, is_active=None, search=None, organization_id=None, **_) -> dict:
    params = {}
    if role: params["role"] = role
    if is_active is not None: params["is_active"] = str(is_active).lower()
    if search: params["search"] = search
    if organization_id: params["organization"] = organization_id
    data = await _django_get("/api/users/list/", headers, params)
    if "error" in data:
        return data
    users = data.get("results", data) if isinstance(data, dict) else data
    return {"success": True, "users": users, "count": data.get("count", len(users)) if isinstance(data, dict) else len(users)}


async def _get_user_detail(headers, user_id=None, **_) -> dict:
    data = await _django_get(f"/api/users/list/{user_id}/", headers)
    return data if "error" in data else {"success": True, "user": data}


async def _get_current_user_summary(headers, **_) -> dict:
    data = await _django_get("/api/users/me/", headers)
    return data if "error" in data else {"success": True, "user": data}


TOOL_HANDLERS = {
    "list_organizations": _list_organizations,
    "get_organization_detail": _get_organization_detail,
    "list_users": _list_users,
    "get_user_detail": _get_user_detail,
    "get_current_user_summary": _get_current_user_summary,
}

# ── JSON Schema primitive → Python type (for building each tool's Pydantic args model) ──
_TYPE_MAP: dict[str, type] = {
    "string": str,
    "integer": int,
    "number": float,
    "boolean": bool,
    "array": list,
    "object": dict,
}


def _build_args_schema(tool_name: str, schema: dict) -> Type[BaseModel]:
    """Dynamically creates a Pydantic model from a JSON Schema dict."""
    props = schema.get("properties", {})
    required = set(schema.get("required", []))
    fields: dict[str, Any] = {}

    for fname, finfo in props.items():
        py_type = _TYPE_MAP.get(finfo.get("type", "string"), str)
        desc = finfo.get("description", "")
        if fname in required:
            fields[fname] = (py_type, Field(..., description=desc))
        else:
            fields[fname] = (py_type | None, Field(default=None, description=desc))

    return create_model(f"{tool_name}Args", **fields)


def _make_tool_coroutine(tool_name: str, headers: dict):
    """Returns an async function bound to this request's auth/tenant headers."""
    handler = TOOL_HANDLERS[tool_name]

    async def _call(**kwargs) -> str:
        try:
            result = await handler(headers, **kwargs)
            return json.dumps(result, indent=2)
        except Exception as e:
            logger.error(f"[{tool_name}] error: {e}")
            return json.dumps({"error": str(e)})

    _call.__name__ = tool_name
    return _call


async def get_tools_for_request(
    context_headers: dict,
    user_role: str,
) -> list[StructuredTool]:
    """
    Builds this request's tools, filtered by role, as LangChain StructuredTools.
    """
    tools = []
    for name in _allowed_tool_names(user_role):
        schema = TOOL_SCHEMAS.get(name)
        if not schema:
            continue
        tools.append(StructuredTool(
            name=name,
            description=schema["description"],
            args_schema=_build_args_schema(name, schema),
            coroutine=_make_tool_coroutine(name, context_headers),
        ))

    logger.info(f"Loaded {len(tools)} tools for role={user_role}")
    return tools
