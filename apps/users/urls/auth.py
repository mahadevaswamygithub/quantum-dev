"""Auth endpoints — mounted at /api/auth/."""
from django.urls import path

from apps.users.views import (
    UserRegistrationView,
    LoginView,
    RefreshTokenView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)

urlpatterns = [
    path("register/",        UserRegistrationView.as_view(), name="auth-register"),
    path("login/",           LoginView.as_view(),            name="auth-login"),
    path("token/refresh/",   RefreshTokenView.as_view(),     name="auth-token-refresh"),
    path("forgot-password/", ForgotPasswordView.as_view(),   name="auth-forgot-password"),
    path("reset-password/",  ResetPasswordView.as_view(),    name="auth-reset-password"),
    path("change-password/", ChangePasswordView.as_view(),   name="auth-change-password"),
]
