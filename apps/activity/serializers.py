from rest_framework import serializers
from .models import ActivityLog


class ActivityLogSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    organization_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'actor_username', 'actor_role', 'organization', 'organization_name',
            'action', 'action_display', 'model_name', 'object_id', 'object_repr',
            'changes', 'ip_address', 'created_at',
        ]

    def get_organization_name(self, obj):
        return obj.organization.name if obj.organization else None
