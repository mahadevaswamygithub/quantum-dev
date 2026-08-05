"""
corex/urls_public.py  (public schema — all requests via localhost)

Each domain owns its own router/urls module (apps/users/urls/<domain>.py,
apps/tenants/urls.py); this file only wires prefixes to them.

  /api/chat/...       → AI chatbot
  /api/auth/...       → auth (login, register, token refresh, passwords)
  /api/users/...      → user CRUD (list, detail, me, bulk ops)
  /api/attendance/... → attendance records
  /api/salary/...     → salary settings, records, advances
  /api/leaves/...     → leave requests, balances, types
  /api/tenants/...    → organization management
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/", include([
        path("chat/",        include("chat.urls")),
        path("auth/",        include("apps.users.urls.auth")),
        path("users/",       include("apps.users.urls.users")),
        path("attendance/",  include("apps.users.urls.attendance")),
        path("salary/",      include("apps.users.urls.payroll")),
        path("leaves/",      include("apps.users.urls.leaves")),
        path("tenants/",     include("apps.tenants.urls")),
    ])),
]
