from django.contrib import admin
from django.urls import path, include

# PUBLIC SCHEMA - All requests via localhost go here
urlpatterns = [
    path('admin/', admin.site.urls),
    
    # All API endpoints
    path('api/', include([
        # Authentication (register, login)
        path('auth/', include('apps.users.urls')),
        
        # Green Admin endpoints
        path('green-admin/', include('apps.green_admin.urls')),
        
        # User management
        path('users/', include('apps.users.urls')),
        
        # Tenant/Organization management
        path('tenants/', include('apps.tenants.urls')),
    ])),
]

print("✓ Public URLs loaded (for localhost)")