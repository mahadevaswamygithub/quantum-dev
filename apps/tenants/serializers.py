from django.utils.crypto import get_random_string
from rest_framework import serializers
from .models import Organization, Domain
from apps.core.serializers import RoundedCoordinatesMixin
from apps.users.models import User
from apps.users.tasks import send_welcome_email


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
            'id', 'name', 'schema_name', 'tenant_type', 'org_type', 'is_active',
            'parent_organization', 'parent_name', 'domains', 'latitude', 'longitude',
            'user_count', 'created_on', 'updated_on',
        ]
        read_only_fields = ['id', 'schema_name', 'created_on', 'updated_on']
 
    def get_parent_name(self, obj):
        return obj.parent_organization.name if obj.parent_organization else None
 
    def get_user_count(self, obj):
        return User.objects.filter(organization=obj).count()
 
 
class OrganizationDetailSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    users = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent_organization.name', read_only=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'schema_name', 'name', 'tenant_type', 'org_type',
            'parent_organization', 'parent_name', 'is_active', 'latitude', 'longitude',
            'created_on', 'updated_on', 'domains', 'users', 'stats'
        ]
    
    def get_users(self, obj):
        from apps.users.serializers import UserSerializer
        users = User.objects.filter(organization=obj)
        return UserSerializer(users, many=True).data
    
    def get_stats(self, obj):
        users = User.objects.filter(organization=obj)
        return {
            'total_users': users.count(),
            'active_users': users.filter(is_active=True).count(),
            'admins': users.filter(role__contains='ADMIN').count(),
        }

class OrganizationCreateSerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    parent_organization_id = serializers.IntegerField(required=False, allow_null=True)
    org_type = serializers.ChoiceField(choices=Organization.ORG_TYPE_CHOICES, required=False, allow_null=True)
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
        admin_password = get_random_string(12)
        User.objects.create_user(
            username=admin_username,
            email=admin_email,
            first_name=admin_first_name,
            last_name=admin_last_name,
            password=admin_password,
            organization=organization,
            role=admin_role,
            is_auto_generated=True,
        )
        send_welcome_email.delay(admin_email, admin_username, admin_password)

        return organization

class OrganizationUpdateSerializer(RoundedCoordinatesMixin, serializers.ModelSerializer):
    org_type = serializers.ChoiceField(choices=Organization.ORG_TYPE_CHOICES, required=False, allow_null=True)

    class Meta:
        model = Organization
        fields = ['name', 'is_active', 'org_type', 'latitude', 'longitude']

    def validate_org_type(self, value):
        if self.instance and self.instance.tenant_type == 'MSP' and value:
            raise serializers.ValidationError("MSP organizations don't have a type.")
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