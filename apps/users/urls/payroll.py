"""Salary endpoints - mounted at /api/salary/. Owns the single canonical
`settings/` registration (previously registered three times across
urls_public.py and the old dual-mounted apps/users/urls.py)."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.users.views import SalaryAdvanceViewSet, SalaryRecordViewSet, SalarySettingsView

router = DefaultRouter()
router.register(r"records", SalaryRecordViewSet, basename="salary-records")
router.register(r"advances", SalaryAdvanceViewSet, basename="salary-advances")

urlpatterns = [
    path("settings/", SalarySettingsView.as_view({'get': 'list', 'put': 'create'}), name="salary-settings"),
    path("", include(router.urls)),
    # NOTE: same flat-vs-nested mismatch as attendance/ above - the router
    # exposes this under records/process/, but api.js calls /salary/process/.
    path("process/", SalaryRecordViewSet.as_view({'post': 'process_salary'}), name='salary-process-flat'),
]
