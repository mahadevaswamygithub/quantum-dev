"""
corex/urls.py  (public schema — all requests via localhost)

KEY FIX: auth/ and users/ previously BOTH pointed to apps.users.urls,
which caused /api/users/me/ → 404 because the router didn't expose it
at the top level, and auth routes were duplicated/conflicting.

Now:
  /api/auth/...   → auth-only URLs (login, register, token, passwords)
  /api/users/...  → user CRUD (list, detail, me, bulk ops)
  /api/chat/...   → AI chatbot
  /api/tenants/.. → organization management
  /api/green-admin/... → super admin
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/", include([

        # ── Chat ─────────────────────────────────────────────────────────────
        path("chat/",        include("chat.urls")),

        # ── Auth (login, register, token refresh, passwords) ─────────────────
        # Exposes: /api/auth/login/ /api/auth/register/ /api/auth/token/refresh/
        #          /api/auth/forgot-password/ /api/auth/reset-password/
        #          /api/auth/change-password/
        path("auth/",        include("apps.users.urls")),

        # ── User management ───────────────────────────────────────────────────
        # Exposes: /api/users/list/           (GET list, POST create)
        #          /api/users/list/<id>/      (GET detail, PUT update, DELETE)
        #          /api/users/list/<id>/toggle_active/
        #          /api/users/list/<id>/change_role/
        #          /api/users/list/bulk_activate/
        #          /api/users/list/bulk_deactivate/
        #          /api/users/list/bulk_delete/
        #          /api/users/list/bulk_change_role/
        #          /api/users/list/export_csv/
        #          /api/users/list/export_json/
        #          /api/users/list/statistics/
        #          /api/users/me/             ← THIS was 404 before
        path("users/",       include("apps.users.urls")),

        # ── Tenant / Organization management ──────────────────────────────────
        # Exposes: /api/tenants/organizations/
        #          /api/tenants/organizations/<id>/
        #          /api/tenants/organizations/<id>/users/
        #          /api/tenants/organizations/<id>/stats/
        #          /api/tenants/organizations/<id>/toggle_status/
        #          /api/tenants/organizations/bulk_activate/
        #          /api/tenants/organizations/bulk_deactivate/
        #          /api/tenants/organizations/export_csv/
        #          /api/tenants/organizations/statistics/
        path("tenants/",     include("apps.tenants.urls")),

        # ── Green Admin (super admin only) ────────────────────────────────────
        # Exposes: /api/green-admin/tenants/
        #          /api/green-admin/tenants/<id>/
        #          /api/green-admin/users/
        #          /api/green-admin/stats/
        path("green-admin/", include("apps.green_admin.urls")),

    ])),
]

print("✓ Public URLs loaded")