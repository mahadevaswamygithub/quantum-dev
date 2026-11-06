from rest_framework import serializers
from .models import Organization, Domain
from apps.core.serializers import RoundedCoordinatesMixin
from apps.users.models import User


class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ['domain', 'is_primary']


class OrganizationSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    parent_name = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()
 
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'logo', 'schema_name', 'tenant_type', 'org_type', 'is_active',
            'parent_organization', 'parent_name', 'domains', 'latitude', 'longitude',
            'user_count', 'created_on', 'updated_on',
        ]
        read_only_fields = ['id', 'schema_name', 'created_on', 'updated_on']
 
    def get_parent_name(self, obj):
        return obj.parent_organization.name if obj.parent_organization else None
 
    def get_user_count(self, obj):
        return User.objects.filter(organization=obj).count()
 
 
class OrganizationCreateSerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    parent_organization_id = serializers.IntegerField(required=False, allow_null=True)
    org_type = serializers.ChoiceField(
        choices=[c for c in Organization.ORG_TYPE_CHOICES if c[0] in Organization.AVAILABLE_ORG_TYPES],
        required=False, allow_null=True,
        error_messages={'invalid_choice': '"{input}" is not available yet. Only Room Booking is supported.'},
    )
    admin_first_name = serializers.CharField(write_only=True)
    admin_last_name = serializers.CharField(write_only=True)
    admin_email = serializers.EmailField(write_only=True)

    class Meta:
        model = Organization
        fields = [
            'name', 'tenant_type', 'org_type', 'parent_organization_id',
            'latitude', 'longitude',
            'admin_first_name', 'admin_last_name', 'admin_email',
        ]

    def validate_admin_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists")
        return value

    def validate_parent_organization_id(self, value):
        if value:
            try:
                org = Organization.objects.get(id=value)
                if org.tenant_type != 'MSP':
                    raise serializers.ValidationError(
                        "Parent organization must be an MSP"
                    )
            except Organization.DoesNotExist:
                raise serializers.ValidationError("Parent organization not found")
        return value
    
    def validate(self, data):
        # If tenant_type is STP and no parent, it should be standalone
        if data['tenant_type'] == 'STP' and not data.get('parent_organization_id'):
            # This is fine - standalone STP
            pass

        # If tenant_type is MSP, it should not have a parent
        if data['tenant_type'] == 'MSP' and data.get('parent_organization_id'):
            raise serializers.ValidationError(
                "MSP cannot have a parent organization"
            )

        # org_type is a business vertical for STP orgs only — MSP orgs are
        # purely administrative and never get one.
        if data['tenant_type'] == 'STP' and not data.get('org_type'):
            raise serializers.ValidationError(
                {'org_type': "Organization type is required for STP organizations."}
            )
        if data['tenant_type'] == 'MSP':
            data['org_type'] = None

        return data
    
    def create(self, validated_data):
        parent_organization_id = validated_data.pop('parent_organization_id', None)
        admin_first_name = validated_data.pop('admin_first_name')
        admin_last_name = validated_data.pop('admin_last_name')
        admin_email = validated_data.pop('admin_email')
        name = validated_data.get('name')

        # Derive schema name (and from it, the domain) from the organization
        # name — de-duplicated in case two orgs share a name/slug.
        base_schema_name = name.lower().replace(' ', '_').replace('-', '_')
        schema_name = base_schema_name
        suffix = 1
        while Organization.objects.filter(schema_name=schema_name).exists():
            suffix += 1
            schema_name = f"{base_schema_name}{suffix}"
        domain_name = f"{schema_name}.localhost"

        # Set parent if provided
        parent_organization = None
        if parent_organization_id:
            parent_organization = Organization.objects.get(id=parent_organization_id)

        # Create organization
        organization = Organization.objects.create(
            schema_name=schema_name,
            parent_organization=parent_organization,
            **validated_data
        )

        # Create domain
        Domain.objects.create(
            domain=domain_name,
            tenant=organization,
            is_primary=True
        )

        # Every organization gets exactly one admin user at creation time
        admin_role = 'MSP_ADMIN' if organization.tenant_type == 'MSP' else 'STP_ADMIN'
        admin_username = f"{schema_name}_admin"
        # No password is generated or emailed: the admin gets a set-your-password
        # link (same as staff invites; "Resend invite" works if it's lost).
        from apps.users.serializers.users import send_invite_email
        admin = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            first_name=admin_first_name,
            last_name=admin_last_name,
            password=None,
            organization=organization,
            role=admin_role,
            is_auto_generated=True,
        )
        send_invite_email(admin)

        return organization

class OwnOrganizationSerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    """Settings → Organization: the requesting admin's *own* org (which an
    MSP's organization list deliberately excludes). Structural fields
    (tenant/org type, parent, active flag) are read-only here — those are
    managed by whoever administers the org, not by the org itself."""
    logo = serializers.SerializerMethodField()
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'logo', 'cover_image', 'tenant_type', 'org_type', 'is_active',
            'contact_email', 'contact_phone', 'address', 'latitude', 'longitude',
            'created_on',
        ]
        read_only_fields = ['id', 'logo', 'cover_image', 'tenant_type', 'org_type', 'is_active', 'created_on']

    def _url(self, f):
        if not f:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(f.url) if request else f.url

    def get_logo(self, obj):
        return self._url(obj.logo)

    def get_cover_image(self, obj):
        return self._url(obj.cover_image)


class OrganizationUpdateSerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    org_type = serializers.ChoiceField(choices=Organization.ORG_TYPE_CHOICES, required=False, allow_null=True)

    class Meta:
        model = Organization
        fields = ['name', 'is_active', 'org_type', 'latitude', 'longitude']

    def validate_org_type(self, value):
        if self.instance and self.instance.tenant_type == 'MSP' and value:
            raise serializers.ValidationError("MSP organizations don't have a type.")
        # Keeping an existing (now-unavailable) type is fine; switching to one isn't.
        current = self.instance.org_type if self.instance else None
        if value and value not in Organization.AVAILABLE_ORG_TYPES and value != current:
            raise serializers.ValidationError(
                f'"{value}" is not available yet. Only Room Booking is supported.'
            )
        return value

    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        if instance.tenant_type == 'STP' and 'org_type' in validated_data:
            instance.org_type = validated_data['org_type']
        if 'latitude' in validated_data:
            instance.latitude = validated_data['latitude']
        if 'longitude' in validated_data:
            instance.longitude = validated_data['longitude']
        instance.save()
        return instance


class OrgEmailSettingsSerializer(serializers.ModelSerializer):
    """Settings → Email. The SMTP password is write-only and stored encrypted;
    leaving it blank keeps the saved one."""
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=255)
    has_password = serializers.SerializerMethodField()
    platform_from = serializers.SerializerMethodField()
    effective_reply_to = serializers.SerializerMethodField()

    class Meta:
        from .models import OrgEmailSettings
        model = OrgEmailSettings
        fields = [
            'send_booking_emails', 'mode', 'from_name', 'reply_to',
            'smtp_host', 'smtp_port', 'smtp_security', 'smtp_username', 'smtp_password', 'from_email',
            'has_password', 'platform_from', 'effective_reply_to', 'last_test_at', 'last_test_ok', 'last_test_error',
        ]
        read_only_fields = ['last_test_at', 'last_test_ok', 'last_test_error']

    def get_has_password(self, obj):
        return bool(obj.smtp_password_encrypted)

    def get_platform_from(self, obj):
        from django.conf import settings
        return settings.DEFAULT_FROM_EMAIL

    def get_effective_reply_to(self, obj):
        return obj.reply_to or obj.organization.contact_email or ''

    def validate_smtp_port(self, value):
        if not 1 <= value <= 65535:
            raise serializers.ValidationError('Enter a valid port (usually 587 or 465).')
        return value

    def validate(self, data):
        mode = data.get('mode', self.instance.mode if self.instance else 'PLATFORM')
        if mode == 'CUSTOM':
            host = data.get('smtp_host', getattr(self.instance, 'smtp_host', ''))
            user = data.get('smtp_username', getattr(self.instance, 'smtp_username', ''))
            has_pw = bool(data.get('smtp_password')) or bool(getattr(self.instance, 'smtp_password_encrypted', ''))
            missing = [n for n, ok in (('server', host), ('username', user), ('password', has_pw)) if not ok]
            if missing:
                raise serializers.ValidationError({'mode': f"To use your own email account, enter the {', '.join(missing)}."})
        return data

    def update(self, instance, validated_data):
        from apps.core.crypto import encrypt
        password = validated_data.pop('smtp_password', '')
        if password:
            instance.smtp_password_encrypted = encrypt(password)
        changed_server = any(k in validated_data and validated_data[k] != getattr(instance, k)
                             for k in ('smtp_host', 'smtp_port', 'smtp_security', 'smtp_username', 'mode')) or bool(password)
        if changed_server:  # an old test result no longer says anything about the new settings
            instance.last_test_at, instance.last_test_ok, instance.last_test_error = None, None, ''
        return super().update(instance, validated_data)

