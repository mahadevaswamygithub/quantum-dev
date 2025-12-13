from django.urls import path
from .views import (
    AllTenantsView, 
    AllUsersView, 
    TenantDetailView,
    TenantStatsView
)

urlpatterns = [
    path('tenants/', AllTenantsView.as_view(), name='green-admin-tenants'),
    path('tenants/<int:pk>/', TenantDetailView.as_view(), name='green-admin-tenant-detail'),
    path('users/', AllUsersView.as_view(), name='green-admin-users'),
    path('stats/', TenantStatsView.as_view(), name='green-admin-stats'),
]

print("✓ Green Admin URLs loaded")