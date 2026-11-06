"""User CRUD + document serializers."""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
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


def _guard_admin_accounts(request, new_role, instance=None):
    """Only admins may create admins, promote to admin, or edit an admin —
    otherwise a staff user with "manage users" could make themselves admin."""
    from apps.core.access import ADMIN_TIERS
    me = getattr(request, 'user', None)
    if me is None or me.role in ADMIN_TIERS:
        return
    if new_role in ADMIN_TIERS or (instance is not None and instance.role in ADMIN_TIERS):
        raise serializers.ValidationError({'role': 'Only an admin can create or change admin accounts.'})


def _resolve_access_role(role, organization, access_role_id, instance=None):
    """The OrgRole a staff user ends up with: none for admins/employees; for
    *_USER the requested role (must belong to their org), else their current
    one, else the org's default preset."""
    from apps.core.access import DEFAULT_PRESET, USER_TIERS
    from ..models import OrgRole
    if role not in USER_TIERS or organization is None:
        return None
    if access_role_id:
        found = OrgRole.objects.filter(id=access_role_id, organization=organization).first()
        if not found:
            raise serializers.ValidationError({'access_role_id': 'That role doesn’t belong to this organization.'})
        return found
    if instance is not None and instance.access_role_id and instance.access_role.organization_id == organization.id:
        return instance.access_role
    return (OrgRole.objects.filter(organization=organization, name=DEFAULT_PRESET.get(organization.tenant_type)).first()
            or OrgRole.objects.filter(organization=organization).first())


def _visible_org_ids(request):
    from apps.core.permissions import get_visible_organization_ids
    return get_visible_organization_ids(request.user, include_own_org=True) or []


def invite_pending(user):
    """Staff/employee account created by invite whose owner hasn't set a password yet."""
    return (user.role != 'CUSTOMER' and user.is_active and user.last_login is None
            and not user.has_usable_password())


def send_invite_email(user):
    """Email a set-your-password link (the same token as password reset).
    Returns True if sent; failures are logged (apps.core.email)."""
    from apps.core.email import send_email
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    invite_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
    org = user.organization.name if user.organization else 'CoreX'
    return send_email(
        f"You're invited to {org} on CoreX",
        f"Hello {user.first_name or ''},\n\n"
        f"An account has been created for you at {org}.\n\n"
        f"Set your password to get started:\n{invite_link}\n\n"
        "If you weren't expecting this, you can ignore this email.\n",
        user.email,
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
    # Staff access (apps.core.access): the custom role and the resulting
    # permission codes — the frontend shows/hides nav, pages and buttons
    # from `permissions`; the API enforces the same codes.
    access_role = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    invite_pending = serializers.SerializerMethodField()
    two_factor_enabled = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'access_role', 'permissions', 'invite_pending', 'two_factor_enabled', 'last_login', 'phone', 'date_of_birth', 'address', 'employee_id',
            'profile_picture', 'daily_rate', 'is_active', 'is_auto_generated',
            'organization', 'organization_id', 'organization_name', 'org_type', 'organization_logo',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_organization_name(self, obj):
        return obj.organization.name if obj.organization else None

    def get_two_factor_enabled(self, obj):
        tf = getattr(obj, 'two_factor', None)
        return bool(tf and tf.enabled)

    def get_invite_pending(self, obj):
        return invite_pending(obj)

    def get_access_role(self, obj):
        role = obj.access_role if obj.role in ('MSP_USER', 'STP_USER') else None
        return {'id': role.id, 'name': role.name} if role else None

    def get_permissions(self, obj):
        from apps.core.access import user_permissions
        return sorted(user_permissions(obj))

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
            'daily_rate', 'organization_id', 'access_role_id',
        ]

    access_role_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    def validate_organization_id(self, value):
        # Staff with "manage users" (checked by the view) may add users to the
        # organizations they can see: their own, and for MSP its client orgs.
        if not Organization.objects.filter(id=value).exists():
            raise serializers.ValidationError("Organization not found")
        if value not in _visible_org_ids(self.context['request']):
            raise serializers.ValidationError("You don't have permission to add users to this organization")
        return value

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
        _guard_admin_accounts(self.context.get('request'), role)
        organization = Organization.objects.filter(id=org_id).first() if org_id else None
        if organization:
            _check_role_matches_org_type(role, organization)
        data['access_role'] = _resolve_access_role(role, organization, data.pop('access_role_id', None))
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
        send_invite_email(user)


class MeUpdateSerializer(serializers.ModelSerializer):
    """What a user may change about *themselves* via /users/me/. Role,
    organization, active flag and pay fields are deliberately absent:
    UserUpdateSerializer accepts those because an admin edits other users
    through it, but self-service must never let a customer or employee
    promote themselves or move into another organization."""

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'address']


class UserUpdateSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(required=False)

    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'role',
            'phone', 'date_of_birth', 'address', 'employee_id',
            'daily_rate', 'is_active', 'organization_id', 'access_role_id',
        ]

    access_role_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    def validate_organization_id(self, value):
        if value:
            if not Organization.objects.filter(id=value).exists():
                raise serializers.ValidationError("Organization not found")
            request = self.context.get('request')
            if request is not None and value not in _visible_org_ids(request):
                raise serializers.ValidationError("You don't have permission to move users to this organization")
        return value

    def validate(self, data):
        # Partial updates may omit role/organization_id entirely — fall back
        # to whatever the instance already has for whichever one is missing.
        role = data.get('role', getattr(self.instance, 'role', None))
        _guard_admin_accounts(self.context.get('request'), role, self.instance)
        org_id = data.get('organization_id', None)
        if org_id is None and self.instance is not None:
            org_id = self.instance.organization_id
        organization = Organization.objects.filter(id=org_id).first() if org_id else None
        if organization:
            _check_role_matches_org_type(role, organization)
        data['access_role'] = _resolve_access_role(role, organization, data.pop('access_role_id', None), self.instance)
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
