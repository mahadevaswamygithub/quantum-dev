"""
Re-exports every view so existing imports like
`from apps.users.views import UserViewSet` keep working unchanged while the
classes themselves live in per-domain modules below.
"""
from .auth import (
    RefreshTokenView,
    UserRegistrationView,
    LoginView,
    LogoutView,
    ImpersonationExchangeView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)
from .users import UserViewSet
from .roles import OrgRoleViewSet
from .two_factor import (
    TwoFactorVerifyView, TwoFactorSetupView, TwoFactorEnableView, TwoFactorStatusView,
    TwoFactorDisableView, TwoFactorBackupCodesView,
)
from .attendance import AttendanceViewSet
from .payroll import (
    SalarySettingsView,
    SalaryRecordViewSet,
    SalaryAdvanceViewSet,
)
from .leaves import (
    LeaveTypeViewSet,
    LeaveRequestViewSet,
    LeaveBalanceViewSet,
)

__all__ = [
    'RefreshTokenView', 'UserRegistrationView', 'LoginView', 'LogoutView',
    'ImpersonationExchangeView',
    'ForgotPasswordView', 'ResetPasswordView', 'ChangePasswordView',
    'UserViewSet',
    'AttendanceViewSet',
    'SalarySettingsView', 'SalaryRecordViewSet', 'SalaryAdvanceViewSet',
    'LeaveTypeViewSet', 'LeaveRequestViewSet', 'LeaveBalanceViewSet',
    'OrgRoleViewSet',
    'TwoFactorVerifyView', 'TwoFactorSetupView', 'TwoFactorEnableView', 'TwoFactorStatusView',
    'TwoFactorDisableView', 'TwoFactorBackupCodesView',
]
