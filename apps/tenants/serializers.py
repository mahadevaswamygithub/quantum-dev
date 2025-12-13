from rest_framework import serializers
from .models import Organization, Domain

class DomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domain
        fields = ['domain', 'is_primary']

class OrganizationSerializer(serializers.ModelSerializer):
    domains = DomainSerializer(many=True, read_only=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Organization
        fields = [
            'id', 'schema_name', 'name', 'tenant_type', 
            'parent_organization', 'is_active', 'created_on', 
            'updated_on', 'domains', 'user_count'
        ]
        read_only_fields = ['schema_name', 'created_on', 'updated_on']
    
    def get_user_count(self, obj):
        return obj.users.count()

class OrganizationCreateSerializer(serializers.ModelSerializer):
    domain_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = Organization
        fields = ['name', 'tenant_type', 'parent_organization', 'domain_name']
    
    def create(self, validated_data):
        domain_name = validated_data.pop('domain_name')
        name = validated_data.get('name')
        
        # Create schema name from organization name
        schema_name = name.lower().replace(' ', '_').replace('-', '_')
        
        # Create organization
        organization = Organization.objects.create(
            schema_name=schema_name,
            **validated_data
        )
        
        # Create domain
        Domain.objects.create(
            domain=domain_name,
            tenant=organization,
            is_primary=True
        )
        
        return organization