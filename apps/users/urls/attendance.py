"""Attendance endpoints - mounted at /api/attendance/."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.users.views import AttendanceViewSet

router = DefaultRouter()
router.register(r"records", AttendanceViewSet, basename="attendance")

urlpatterns = [
    path("", include(router.urls)),
    # NOTE: the router only exposes these under records/ (e.g.
    # attendance/records/summary/), but corex-rct/src/services/api.js calls
    # the flat paths below - these route to the exact same actions so both
    # the "correct" nested form and what the frontend actually calls work.
    path("summary/", AttendanceViewSet.as_view({'get': 'summary'}), name='attendance-summary-flat'),
    path("bulk_mark/", AttendanceViewSet.as_view({'post': 'bulk_mark'}), name='attendance-bulk-mark-flat'),
    path("export/", AttendanceViewSet.as_view({'get': 'export'}), name='attendance-export-flat'),
]
