from django.contrib import admin
from .models import ActivityLog


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    # Append-only audit trail - no add/change/delete from admin either.
    list_display = ['created_at', 'actor_username', 'actor_role', 'action', 'model_name', 'object_repr', 'organization']
    list_filter = ['action', 'model_name', 'actor_role']
    search_fields = ['actor_username', 'object_repr', 'organization__name']
    readonly_fields = [f.name for f in ActivityLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
