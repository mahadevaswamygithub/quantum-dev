"""Leave endpoints — mounted at /api/leaves/."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.users.views import LeaveBalanceViewSet, LeaveRequestViewSet, LeaveTypeViewSet

router = DefaultRouter()
router.register(r"requests", LeaveRequestViewSet, basename="leaves")
router.register(r"balance", LeaveBalanceViewSet, basename="leave-balance")
router.register(r"types", LeaveTypeViewSet, basename="leave-types")

urlpatterns = [
    path("", include(router.urls)),
]
