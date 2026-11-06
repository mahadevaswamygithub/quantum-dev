"""Auth endpoints — mounted at /api/auth/."""
from django.urls import path

from apps.users.views import (
    UserRegistrationView,
    LoginView,
    LogoutView,
    ImpersonationExchangeView,
    RefreshTokenView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
    TwoFactorVerifyView, TwoFactorSetupView, TwoFactorEnableView, TwoFactorStatusView,
    TwoFactorDisableView, TwoFactorBackupCodesView,
)

urlpatterns = [
    path("register/",            UserRegistrationView.as_view(),         name="auth-register"),
    path("login/",                LoginView.as_view(),                    name="auth-login"),
    path("logout/",               LogoutView.as_view(),                   name="auth-logout"),
    path("impersonate/exchange/", ImpersonationExchangeView.as_view(),    name="auth-impersonate-exchange"),
    path("token/refresh/",       RefreshTokenView.as_view(),             name="auth-token-refresh"),
    path("forgot-password/",     ForgotPasswordView.as_view(),           name="auth-forgot-password"),
    path("reset-password/",      ResetPasswordView.as_view(),            name="auth-reset-password"),
    path("change-password/",     ChangePasswordView.as_view(),           name="auth-change-password"),
    # Two-step verification
    path("2fa/verify/",          TwoFactorVerifyView.as_view(),          name="auth-2fa-verify"),
    path("2fa/setup/",           TwoFactorSetupView.as_view(),           name="auth-2fa-setup"),
    path("2fa/enable/",          TwoFactorEnableView.as_view(),          name="auth-2fa-enable"),
    path("2fa/status/",          TwoFactorStatusView.as_view(),          name="auth-2fa-status"),
    path("2fa/disable/",         TwoFactorDisableView.as_view(),         name="auth-2fa-disable"),
    path("2fa/backup-codes/",    TwoFactorBackupCodesView.as_view(),     name="auth-2fa-backup-codes"),
]
