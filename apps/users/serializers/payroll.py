"""Salary settings, salary records, and salary advance serializers."""
from rest_framework import serializers

from ..models import SalaryAdvance, SalaryRecord, SalarySettings


class SalarySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalarySettings
        fields = [
            'id', 'default_daily_rate', 'working_days_per_month',
            'overtime_rate_multiplier', 'advance_limit_percent',
            'salary_day', 'currency', 'currency_symbol',
        ]


class SalaryRecordSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = SalaryRecord
        fields = [
            'id', 'user', 'user_name', 'month', 'days_present',
            'daily_rate', 'gross_salary', 'deductions', 'advances_deducted',
            'net_salary', 'status', 'notes', 'processed_at', 'paid_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'gross_salary', 'net_salary', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name()

    def create(self, validated_data):
        record = SalaryRecord(**validated_data)
        record.calculate()
        record.save()
        return record

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.calculate()
        instance.save()
        return instance


class SalaryAdvanceSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    date = serializers.SerializerMethodField()

    class Meta:
        model = SalaryAdvance
        fields = [
            'id', 'user', 'user_name', 'amount', 'note', 'status',
            'date', 'approved_by', 'approved_at', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'approved_by', 'approved_at', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name()

    def get_date(self, obj):
        return obj.requested_on.strftime('%Y-%m-%d') if obj.requested_on else None
