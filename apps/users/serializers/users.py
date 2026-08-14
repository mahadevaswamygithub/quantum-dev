"""User CRUD + document serializers."""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers

from apps.tenants.models import Organization
from ..models import User, UserDocument


def _check_role_matches_org_type(role, organization):
    """MSP_* roles only make sense for a user in an MSP organization, and
    vice versa — an STP admin (or MSP admin managing an STP sub-org) must
    never be able to grant an MSP role, since MSP-role routes/permissions
    are role-only checks elsewhere (not re-scoped to the org), so a
    mismatched role would be a real privilege escalation, not just a
    cosmetic mixup. Raises DRF ValidationError if they don't match."""
    if not role or not organization:
        return
    is_msp_role = role.startswith('MSP_')
    if is_msp_role and organization.tenant_type != 'MSP':
        raise serializers.ValidationError(
            {'role': 'MSP roles can only be assigned to users in an MSP organization.'}
        )
    if not is_msp_role and organization.tenant_type == 'MSP':
        raise serializers.ValidationError(
            {'role': 'This is an MSP organization — assign an MSP role, or pick an STP organization for this role.'}
        )


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    organization_id = serializers.SerializerMethodField()
    # The user's own organization's business vertical — lets the frontend
    # conditionally show vertical-specific nav/routes (e.g. Rooms/Bookings
    # for a ROOM_BOOKING org) straight off the login/`me` response, with no
    # extra API call. Not a field on User itself; it's read from
    # organization.org_type (apps.tenants.models.Organization).
    org_type = serializers.SerializerMethodField()
    # The user's own organization's logo — lets the navbar show org branding
    # straight off the login/`me` response, same reasoning as org_type above.
    organization_logo = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'date_of_birth', 'address', 'employee_id',
            'profile_picture', 'daily_rate', 'is_active', 'is_auto_generated',
            'organization', 'organization_id', 'organization_name', 'org_type', 'organization_logo',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_organization_name(self, obj):
        return obj.organization.name if obj.organization else None

    def get_organization_id(self, obj):
        return obj.organization.id if obj.organization else None

    def get_org_type(self, obj):
        return obj.organization.org_type if obj.organization else None

    def get_organization_logo(self, obj):
        if not obj.organization or not obj.organization.logo:
            return None
        request = self.context.get('request')
        url = obj.organization.logo.url
        return request.build_absolute_uri(url) if request else url


class UserCreateSerializer(serializers.ModelSerializer):
    # No password field — admins invite a user by email instead of setting
    # one on their behalf. The account is created with an unusable password
    # (blocks login until they set one) and an emailed link, using the same
    # uid/token mechanism as the forgot-password flow, lets them set it.
    organization_id = serializers.IntegerField(required=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'date_of_birth', 'address', 'employee_id',
            'daily_rate', 'organization_id',
        ]

    def validate_organization_id(self, value):
        # NOTE: intentionally NOT using apps.core.permissions here — this
        # check has slightly different semantics per role than the shared
        # queryset-scoping helper (e.g. STP_USER is deliberately excluded
        # below, unlike the queryset-scoping call sites), so it's kept as
        # its own explicit rule rather than force-fit into the shared one.
        try:
            organization = Organization.objects.get(id=value)
            # Check if requesting user has permission to add users to this org
            request_user = self.context['request'].user

            if request_user.role in ['MSP_ADMIN', 'MSP_USER']:
                # MSP can add users to their org or sub-orgs
                if organization.id == request_user.organization.id or \
                   organization.parent_organization == request_user.organization:
                    return value
            elif request_user.role in ['STP_ADMIN']:
                # STP admin can only add to their org
                if organization.id == request_user.organization.id:
                    return value

            raise serializers.ValidationError(
                "You don't have permission to add users to this organization"
            )
        except Organization.DoesNotExist:
            raise serializers.ValidationError("Organization not found")

    def validate_role(self, value):
        # CUSTOMER accounts are self-registered only (apps.bookings'
        # customer-registration endpoint sets their own password
        # immediately) — the staff invite flow this serializer backs is a
        # different UX (unusable password + emailed set-password link) and
        # was never meant to create end customers.
        if value == 'CUSTOMER':
            raise serializers.ValidationError("Customer accounts are created via self-registration, not the staff invite form.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value

    def validate(self, data):
        org_id = data.get('organization_id')
        role = data.get('role', 'STP_USER')  # matches the model field's own default
        if org_id:
            organization = Organization.objects.filter(id=org_id).first()
            _check_role_matches_org_type(role, organization)
        return data

    def create(self, validated_data):
        org_id = validated_data.pop('organization_id', None)
        user = User(**validated_data)
        user.set_unusable_password()
        if org_id:
            try:
                user.organization = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                pass
        user.save()
        self._send_invite_email(user)
        return user

    def _send_invite_email(self, user):
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        invite_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

        subject = "You're invited to CoreX Platform"
        message = f"""
                Hello {user.first_name},

                An account has been created for you on CoreX Platform.

                Click the link below to set your password and get started:
                {invite_link}

                If you weren't expecting this, you can safely ignore this email.

                Best regards,
                CoreX Team
                """
        # fail_silently — an email hiccup shouldn't roll back a user that's
        # already been created. If it does fail to send, they (or an admin)
        # can still get a working link via the ordinary "Forgot Password"
        # flow on the login page — it works for any user regardless of
        # whether they've ever set a password.
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )


class UserUpdateSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(required=False)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'role',
            'phone', 'date_of_birth', 'address', 'employee_id',
            'daily_rate', 'is_active', 'organization_id',
        ]

    def validate_organization_id(self, value):
        if value:
            try:
                Organization.objects.get(id=value)
            except Organization.DoesNotExist:
                raise serializers.ValidationError("Organization not found")
        return value

    def validate(self, data):
        # Partial updates may omit role/organization_id entirely — fall back
        # to whatever the instance already has for whichever one is missing.
        role = data.get('role', getattr(self.instance, 'role', None))
        org_id = data.get('organization_id', None)
        if org_id is None and self.instance is not None:
            org_id = self.instance.organization_id
        if org_id:
            organization = Organization.objects.filter(id=org_id).first()
            _check_role_matches_org_type(role, organization)
        return data

    def update(self, instance, validated_data):
        org_id = validated_data.pop('organization_id', None)
        if org_id is not None:
            try:
                instance.organization = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                instance.organization = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class UserDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = UserDocument
        fields = ['id', 'document_type', 'file', 'file_url', 'uploaded_at', 'updated_at']
        read_only_fields = ['id', 'uploaded_at', 'updated_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else None
