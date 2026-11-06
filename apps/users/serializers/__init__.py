"""
Re-exports every serializer so existing imports like
`from apps.users.serializers import UserSerializer` keep working unchanged
while the classes themselves live in per-domain modules below.
"""
from .auth import UserRegistrationSerializer
from .users import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    MeUpdateSerializer,
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
    'UserRegistrationSerializer',
    'UserSerializer', 'UserCreateSerializer', 'UserUpdateSerializer', 'MeUpdateSerializer', 'UserDocumentSerializer',
    'AttendanceSerializer', 'AttendanceBulkSerializer',
    'SalarySettingsSerializer', 'SalaryRecordSerializer', 'SalaryAdvanceSerializer',
    'LeaveTypeSerializer', 'LeaveRequestSerializer', 'LeaveBalanceSerializer',
]
