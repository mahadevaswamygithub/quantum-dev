from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OrganizationViewSet
from .platform_views import PlatformCustomerViewSet

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet, basename='organization')
# Platform owner console (role PLATFORM_ADMIN only).
router.register(r'platform/customers', PlatformCustomerViewSet, basename='platform-customer')

urlpatterns = [
    path('', include(router.urls)),
]
