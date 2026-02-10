from rest_framework import serializers
from .models import Organization, Domain
from apps.users.models import User

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ['domain', 'is_primary']

class OrganizationSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    user_count = serializers.SerializerMethodField()
    parent_name = serializers.CharField(source='parent_organization.name', read_only=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'schema_name', 'name', 'tenant_type', 
            'parent_organization', 'parent_name', 'is_active', 
            'created_on', 'updated_on', 'domains', 'user_count'
        ]
        read_only_fields = ['schema_name', 'created_on', 'updated_on']
    
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
            'id', 'schema_name', 'name', 'tenant_type', 
            'parent_organization', 'parent_name', 'is_active', 
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

class OrganizationCreateSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(write_only=True)
    parent_organization_id = serializers.IntegerField(required=False, allow_null=True)
    
    class Meta:
        model = Organization
        fields = ['name', 'tenant_type', 'parent_organization_id', 'domain_name']
    
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
        
        return data
    
    def create(self, validated_data):
        domain_name = validated_data.pop('domain_name')
        parent_organization_id = validated_data.pop('parent_organization_id', None)
        name = validated_data.get('name')
        
        # Create schema name from organization name
        schema_name = name.lower().replace(' ', '_').replace('-', '_')
        
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
        
        return organization

class OrganizationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['name', 'is_active']
    
    def update(self, instance, validated_data):
        instance.name = validated_data.get('name', instance.name)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        instance.save()
        return instance