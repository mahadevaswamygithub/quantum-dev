"""Registration, login, and password-reset/change serializers."""
from rest_framework import serializers
from django.conf import settings

from apps.tenants.models import Organization, Domain
from ..models import User


class UserRegistrationSerializer(serializers.ModelSerializer):
    """Public "create your organization" sign-up (only when
    settings.ALLOW_PUBLIC_ORG_SIGNUP is on). Creates one Room Booking STP
    organization with the person signing up as its admin. MSP organizations
    are never self-created, and no other accounts are made."""
    tenant_type = serializers.ChoiceField(choices=['STP'], required=False, default='STP')
    organization_name = serializers.CharField(write_only=True, max_length=100)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name',
                  'password', 'organization_name', 'tenant_type']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, data):
        from apps.core.login_guard import password_problems
        problems = password_problems(data.get('password'), User(email=data.get('email', ''), username=data.get('username', ''),
                                                                first_name=data.get('first_name', ''), last_name=data.get('last_name', '')))
        if problems:
            raise serializers.ValidationError({'password': problems})
        return data

    def create(self, validated_data):
        import re
        from django.db import transaction
        from apps.core.email import send_email
        validated_data.pop('tenant_type', None)
        organization_name = validated_data.pop('organization_name').strip()
        password = validated_data.pop('password')

        base = re.sub(r'[^a-z0-9_]', '_', organization_name.lower()).strip('_')[:40] or 'org'
        if base[0].isdigit():
            base = f'org_{base}'
        schema_name, n = base, 1
        while Organization.objects.filter(schema_name=schema_name).exists():
            n += 1
            schema_name = f'{base}{n}'

        with transaction.atomic():
            organization = Organization.objects.create(
                schema_name=schema_name, name=organization_name, tenant_type='STP', org_type='ROOM_BOOKING',
            )
            Domain.objects.create(domain=f'{schema_name}.localhost', tenant=organization, is_primary=True)
            user = User(organization=organization, role='STP_ADMIN', **validated_data)
            user.set_password(password)
            user.save()

        send_email(
            f'Welcome to CoreX — {organization.name} is ready',
            f"Hello {user.first_name},\n\nYour organization {organization.name} has been created and you are its admin.\n"
            f"Sign in at {settings.FRONTEND_URL}/login with {user.email}.\n",
            user.email,
        )
        return user
