from rest_framework import serializers
from .models import User
from apps.tenants.models import Organization, Domain
from django.contrib.auth.hashers import make_password
from .tasks import send_welcome_email

class UserRegistrationSerializer(serializers.ModelSerializer):
    tenant_type = serializers.ChoiceField(choices=['MSP', 'STP'])
    organization_name = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 
                  'password', 'organization_name', 'tenant_type']
    
    def create(self, validated_data):
        tenant_type = validated_data.pop('tenant_type')
        organization_name = validated_data.pop('organization_name')
        password = validated_data.pop('password')
        
        # Create organization
        schema_name = organization_name.lower().replace(' ', '_').replace('-', '_')
        organization = Organization.objects.create(
            schema_name=schema_name,
            name=organization_name,
            tenant_type=tenant_type
        )
        
        # Create domain - Use subdomain format for development
        # For production, you might want actual domains
        domain_name = f"{schema_name}.localhost"  # or use "localhost" for testing
        
        Domain.objects.create(
            domain=domain_name,
            tenant=organization,
            is_primary=True
        )
        # Create main user
        user = User.objects.create_user(
            email=validated_data['email'],
            username=validated_data['username'],  # or however you define it
            password=password,                    # do NOT hash manually
            organization=organization,
            role='MSP_ADMIN' if tenant_type == 'MSP' else 'STP_ADMIN'
        )
        
        # Create auto-generated admin user
        admin_email = f"{schema_name}-admin@corex.com"
        admin_password =  'password'   #User.objects.make_random_password()
        admin_user = User.objects.create_user(
            username=f"{schema_name}_admin",
            email=admin_email,
            first_name="Admin",
            last_name=organization_name,
            password='password123!',
            organization=organization,
            role='GREEN_ADMIN',
            is_auto_generated=True
        )
        
        # Send welcome emails
        send_welcome_email.delay(user.email, user.username)
        send_welcome_email.delay(admin_email, admin_user.username, admin_password)
        
        return user


class UserSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 
                  'organization_name', 'role', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'role']
    
    def validate_role(self, value):
        # Add custom role validation logic here
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)