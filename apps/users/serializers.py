from rest_framework import serializers

from apps.users.tasks import send_welcome_email
from .models import User
from apps.tenants.models import Organization, Domain
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings


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


# =======================================================================

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    
    def validate_email(self, value):
        try:
            user = User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("No user found with this email address.")
        return value
    
    def save(self):
        email = self.validated_data['email']
        user = User.objects.get(email=email)
        
        # Generate token
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Create reset link
        reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"
        
        # Send email
        subject = 'Password Reset Request - CoreX Platform'
        message = f"""
                Hello {user.first_name},

                You requested to reset your password for CoreX Platform.

                Click the link below to reset your password:
                {reset_link}

                This link will expire in 24 hours.

                If you didn't request this, please ignore this email.

                Best regards,
                CoreX Team
                """
            
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
        
        return user


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        
        # Validate uid and token
        try:
            uid = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError("Invalid reset link.")
        
        if not default_token_generator.check_token(user, data['token']):
            raise serializers.ValidationError("Reset link has expired or is invalid.")
        
        data['user'] = user
        return data
    
    def save(self):
        user = self.validated_data['user']
        new_password = self.validated_data['new_password']
        
        user.set_password(new_password)
        user.save()
        
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value
    
    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        return data
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user