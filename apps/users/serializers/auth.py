"""Registration, login, and password-reset/change serializers."""
from rest_framework import serializers
from django.conf import settings

from ..models import User


class UserRegistrationSerializer(serializers.Serializer):
    """Public "list your hotels on CoreX" sign-up (only when
    settings.ALLOW_PUBLIC_ORG_SIGNUP is on).

    Creates a customer account in PENDING status (set-up allowed, hidden from
    guests until the platform owner approves it):
      - account_type STP: a single business; its hotels are Properties.
      - account_type MSP: a hotel group / management company; each hotel is a
        client organization with its own manager.
    No password here: the admin gets an emailed link to set one, which also
    proves they own the address (apps.tenants.onboarding)."""
    account_type = serializers.ChoiceField(choices=['STP', 'MSP'], default='STP')
    organization_name = serializers.CharField(max_length=100)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_organization_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter your business name.')
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists. Sign in instead.')
        return value

    def create(self, validated_data):
        from apps.tenants.onboarding import create_customer
        _org, admin = create_customer(
            account_type=validated_data['account_type'], name=validated_data['organization_name'],
            first_name=validated_data['first_name'].strip(), last_name=validated_data['last_name'].strip(),
            email=validated_data['email'], phone=validated_data.get('phone', ''),
            status='PENDING', signed_up=True, property_limit=settings.SIGNUP_PROPERTY_LIMIT,
        )
        return admin
