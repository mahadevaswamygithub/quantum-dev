"""
corex/urls.py — TENANT SCHEMA urlconf, used for requests resolved to a
tenant-specific domain (as opposed to corex/urls_public.py, used for the
public schema). Reproduces the exact endpoint set the old flat
apps/users/urls.py exposed here: auth + user CRUD + salary settings only —
attendance/salary-records/salary-advances/leaves were never wired into this
urlconf and stay that way.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.users.views import (
    UserRegistrationView,
    LoginView,
    RefreshTokenView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
    UserViewSet,
    SalarySettingsView,
)

router = DefaultRouter()
router.register(r'list', UserViewSet, basename='tenant-user')

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/', include([
        path('users/', include([
            path('register/',        UserRegistrationView.as_view(), name='tenant-auth-register'),
            path('login/',           LoginView.as_view(),            name='tenant-auth-login'),
            path('token/refresh/',   RefreshTokenView.as_view(),     name='tenant-auth-token-refresh'),
            path('forgot-password/', ForgotPasswordView.as_view(),   name='tenant-auth-forgot-password'),
            path('reset-password/',  ResetPasswordView.as_view(),    name='tenant-auth-reset-password'),
            path('change-password/', ChangePasswordView.as_view(),   name='tenant-auth-change-password'),
            path('salary/settings/', SalarySettingsView.as_view({'get': 'list', 'put': 'create'}), name='tenant-salary-settings'),
            path('', include(router.urls)),
            path('me/', UserViewSet.as_view({'get': 'me', 'put': 'me'}), name='tenant-user-me'),
        ])),
        path('tenants/', include('apps.tenants.urls')),
    ])),
]
