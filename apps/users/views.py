from rest_framework import status, generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import models
from .serializers import (
    UserRegistrationSerializer, 
    UserSerializer, 
    LoginSerializer,
    UserUpdateSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer
)
from .models import User

from rest_framework_simplejwt.views import TokenRefreshView

class RefreshTokenView(TokenRefreshView):
    """Refresh access token"""
    pass

class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            'message': 'Registration successful. Welcome emails have been sent.',
            'user': {
                'username': user.username,
                'email': user.email,
                'organization': user.organization.name,
                'role': user.role
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    
    def post(self, request):
        #import pdb; pdb.set_trace()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        # Try to get user by email
        try:
            user_obj = User.objects.get(email=email)
            user = authenticate(request, email=email, password=password)
        except Exception as e:
            print("User does not exist", str(e))
            user = None
        
        if user is None:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
            return Response({
                'error': 'Account is inactive'
            }, status=status.HTTP_403_FORBIDDEN)
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'organization': user.organization.name if user.organization else None,
                'organization_id': user.organization.id if user.organization else None,
                'tenant_type': user.organization.tenant_type if user.organization else None
            }
        })


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Green Admin can see all users
        if user.role == 'GREEN_ADMIN':
            return User.objects.all()
        
        # MSP users can see their organization and sub-organization users
        elif user.role in ['MSP_ADMIN', 'MSP_USER']:
            sub_org_ids = user.organization.sub_organizations.values_list('id', flat=True)
            return User.objects.exclude(role='GREEN_ADMIN').filter(
                models.Q(organization=user.organization) |
                models.Q(organization_id__in=sub_org_ids)
            )
        
        # STP users can only see their organization users
        else:
            return User.objects.exclude(role='GREEN_ADMIN').filter(organization=user.organization)
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user details"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Activate or deactivate a user"""
        user = self.get_object()
        
        # Prevent users from deactivating themselves
        if user.id == request.user.id:
            return Response(
                {'error': 'You cannot deactivate your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.is_active = not user.is_active
        user.save()
        
        return Response({
            'message': f'User {"activated" if user.is_active else "deactivated"}',
            'is_active': user.is_active
        })
    
    @action(detail=True, methods=['put'])
    def change_role(self, request, pk=None):
        """Change user role"""
        user = self.get_object()
        new_role = request.data.get('role')
        
        if new_role not in dict(User.ROLE_CHOICES):
            return Response(
                {'error': 'Invalid role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.role = new_role
        user.save()
        
        return Response({
            'message': 'User role updated successfully',
            'role': user.role
        })


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'GREEN_ADMIN':
            return User.objects.all()
        elif user.role in ['MSP_ADMIN', 'MSP_USER']:
            sub_org_ids = user.organization.sub_organizations.values_list('id', flat=True)
            return User.objects.filter(
                models.Q(organization=user.organization) |
                models.Q(organization_id__in=sub_org_ids)
            )
        else:
            return User.objects.filter(organization=user.organization)
        


class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Password reset link has been sent to your email.'
        }, status=status.HTTP_200_OK)


class ResetPasswordView(generics.GenericAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Password has been reset successfully. You can now login with your new password.'
        }, status=status.HTTP_200_OK)


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'Password changed successfully.'
        }, status=status.HTTP_200_OK)