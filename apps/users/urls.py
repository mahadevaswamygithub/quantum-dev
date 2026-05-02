"""
apps/users/urls.py

Registered under BOTH:
  path('auth/',  include('apps.users.urls'))  → auth endpoints
  path('users/', include('apps.users.urls'))  → user CRUD endpoints

The router handles /users/list/ and /users/list/<id>/
Explicit paths handle /auth/... and /users/me/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserViewSet,
    UserRegistrationView,
    LoginView,
    RefreshTokenView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

# ── CRUD router → /api/users/list/ ───────────────────────────────────────────
router = DefaultRouter()
router.register(r"list", UserViewSet, basename="user")

urlpatterns = [
    # ── Auth endpoints (used when mounted at /api/auth/) ─────────────────────
    path("register/",        UserRegistrationView.as_view(), name="auth-register"),
    path("login/",           LoginView.as_view(),            name="auth-login"),
    path("token/refresh/",   RefreshTokenView.as_view(),     name="auth-token-refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(),   name="auth-forgot-password"),
    path("reset-password/",  ResetPasswordView.as_view(),    name="auth-reset-password"),
    path("change-password/", ChangePasswordView.as_view(),   name="auth-change-password"),

    # ── User CRUD (used when mounted at /api/users/) ──────────────────────────
    # /api/users/list/           GET=list  POST=create
    # /api/users/list/<id>/      GET=detail PUT=update DELETE=delete
    # /api/users/list/<id>/toggle_active/
    # /api/users/list/<id>/change_role/
    # /api/users/list/bulk_activate/ etc.
    path("", include(router.urls)),

    # /api/users/me/  — explicit so it works whether mounted at /auth/ or /users/
    path("me/", UserViewSet.as_view({"get": "me"}), name="user-me"),
]

print("✓ Users URLs loaded")