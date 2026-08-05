"""
Re-exports every serializer so existing imports like
`from apps.users.serializers import UserSerializer` keep working unchanged
while the classes themselves live in per-domain modules below.
"""
from .auth import (
    UserRegistrationSerializer,
    LoginSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer,
)
from .users import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    UserDocumentSerializer,
)
from .attendance import (
    AttendanceSerializer,
    AttendanceBulkSerializer,
)
from .payroll import (
    SalarySettingsSerializer,
    SalaryRecordSerializer,
    SalaryAdvanceSerializer,
)
from .leaves import (
    LeaveTypeSerializer,
    LeaveRequestSerializer,
    LeaveBalanceSerializer,
)

__all__ = [
    'UserRegistrationSerializer', 'LoginSerializer', 'ForgotPasswordSerializer',
    'ResetPasswordSerializer', 'ChangePasswordSerializer',
    'UserSerializer', 'UserCreateSerializer', 'UserUpdateSerializer', 'UserDocumentSerializer',
    'AttendanceSerializer', 'AttendanceBulkSerializer',
    'SalarySettingsSerializer', 'SalaryRecordSerializer', 'SalaryAdvanceSerializer',
    'LeaveTypeSerializer', 'LeaveRequestSerializer', 'LeaveBalanceSerializer',
]
