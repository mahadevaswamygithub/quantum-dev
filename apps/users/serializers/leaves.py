"""Leave type, leave request, and leave balance serializers."""
from rest_framework import serializers

from ..models import LeaveBalance, LeaveRequest, LeaveType


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = '__all__'


class LeaveRequestSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            'id', 'user', 'user_name', 'leave_type', 'from_date', 'to_date',
            'days', 'reason', 'status', 'approved_by', 'approved_at',
            'rejection_reason', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'days', 'status', 'approved_by', 'approved_at', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name()

    def validate(self, data):
        from_date = data.get('from_date')
        to_date = data.get('to_date')
        if from_date and to_date and to_date < from_date:
            raise serializers.ValidationError("to_date must be after from_date.")
        return data


class LeaveBalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveBalance
        fields = ['id', 'leave_type', 'year', 'allocated', 'used', 'remaining']
