"""Attendance serializers."""
from rest_framework import serializers

from ..models import AttendanceRecord


class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceRecord
        fields = [
            'id', 'user', 'user_name', 'date', 'status',
            'check_in', 'check_out', 'hours_worked', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'hours_worked', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() if obj.user else None


class AttendanceBulkSerializer(serializers.Serializer):
    date = serializers.DateField()
    records = serializers.ListField(
        child=serializers.DictField()
    )
