from django.contrib import admin
from django.urls import path, include

# TENANT SCHEMA - For tenant-specific domains
urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/', include([
        path('users/', include('apps.users.urls')),
        path('tenants/', include('apps.tenants.urls')),
    ])),
]

print("✓ Tenant URLs loaded (for tenant domains)")