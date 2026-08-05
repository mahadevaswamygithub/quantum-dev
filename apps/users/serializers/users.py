"""User CRUD + document serializers."""
from rest_framework import serializers

from apps.tenants.models import Organization
from ..models import User, UserDocument


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.SerializerMethodField()
    organization_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'date_of_birth', 'address', 'employee_id',
            'profile_picture', 'daily_rate', 'is_active', 'is_auto_generated',
            'organization', 'organization_id', 'organization_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_organization_name(self, obj):
        return obj.organization.name if obj.organization else None

    def get_organization_id(self, obj):
        return obj.organization.id if obj.organization else None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    organization_id = serializers.IntegerField(required=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name', 'password',
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

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already taken")
        return value

    def create(self, validated_data):
        org_id = validated_data.pop('organization_id', None)
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        if org_id:
            try:
                user.organization = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                pass
        user.save()
        return user


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
