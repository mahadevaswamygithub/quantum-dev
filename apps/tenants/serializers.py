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
        users = User.objects.filter(organization=obj)[:10]  # First 10 users
        return UserSerializer(users, many=True).data
    
    def get_stats(self, obj):
        users = User.objects.filter(organization=obj)
        return {
            'total_users': users.count(),
            'active_users': users.filter(is_active=True).count(),
            'admins': users.filter(role__contains='ADMIN').count(),
        }