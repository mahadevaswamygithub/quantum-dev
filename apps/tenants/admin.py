from django.contrib import admin
from django_tenants.admin import TenantAdminMixin
from .models import Organization, Domain

@admin.register(Organization)
class OrganizationAdmin(TenantAdminMixin, admin.ModelAdmin):
    list_display = ['name', 'schema_name', 'tenant_type', 'is_active', 'created_on']
    list_filter = ['tenant_type', 'is_active', 'created_on']
    search_fields = ['name', 'schema_name']
    readonly_fields = ['schema_name', 'created_on', 'updated_on']

@admin.register(Domain)
class DomainAdmin(admin.ModelAdmin):
    list_display = ['domain', 'tenant', 'is_primary']
    list_filter = ['is_primary']
    search_fields = ['domain', 'tenant__name']