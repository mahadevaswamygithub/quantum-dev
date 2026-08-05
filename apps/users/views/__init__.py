"""
Re-exports every view so existing imports like
`from apps.users.views import UserViewSet` keep working unchanged while the
classes themselves live in per-domain modules below.
"""
from .auth import (
    RefreshTokenView,
    UserRegistrationView,
    LoginView,
    ForgotPasswordView,
    ResetPasswordView,
    ChangePasswordView,
)
from .users import UserViewSet
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
    'RefreshTokenView', 'UserRegistrationView', 'LoginView',
    'ForgotPasswordView', 'ResetPasswordView', 'ChangePasswordView',
    'UserViewSet',
    'AttendanceViewSet',
    'SalarySettingsView', 'SalaryRecordViewSet', 'SalaryAdvanceViewSet',
    'LeaveTypeViewSet', 'LeaveRequestViewSet', 'LeaveBalanceViewSet',
]
