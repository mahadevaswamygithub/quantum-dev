import csv
from django.http import HttpResponse
from rest_framework import status, generics, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db import models
from datetime import datetime
from django.db.models import Q
from .serializers import (
    UserCreateSerializer,
    UserRegistrationSerializer, 
    UserSerializer, 
    LoginSerializer,
    UserUpdateSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer,
    ChangePasswordSerializer
)
from .models import User
import json

from rest_framework_simplejwt.views import TokenRefreshView

import logging

logger = logging.getLogger(__name__)

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
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Green Admin can see all users
        if user.role == 'GREEN_ADMIN':
            return User.objects.all()
        
        # MSP users can see their organization and sub-organization users
        elif user.role in ['MSP_ADMIN', 'MSP_USER']:
            sub_org_ids = user.organization.sub_organizations.values_list('id', flat=True)
            return User.objects.filter(
                Q(organization=user.organization) |
                Q(organization_id__in=sub_org_ids)
            )
        
        # STP users can only see their organization users
        else:
            return User.objects.filter(organization=user.organization)
    
    def create(self, request, *args, **kwargs):
        logger.info(f"Creating user: {request.data}")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            'message': 'User created successfully',
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # Prevent users from updating themselves to a different role
        if instance.id == request.user.id and 'role' in request.data:
            if request.data['role'] != instance.role:
                return Response({
                    'error': 'You cannot change your own role'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            'message': 'User updated successfully',
            'user': UserSerializer(user).data
        })
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Prevent users from deleting themselves
        if instance.id == request.user.id:
            return Response({
                'error': 'You cannot delete your own account'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        instance.delete()
        return Response({
            'message': 'User deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)
    
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
            'is_active': user.is_active,
            'user': UserSerializer(user).data
        })
    
    @action(detail=True, methods=['put'])
    def change_role(self, request, pk=None):
        """Change user role"""
        user = self.get_object()
        new_role = request.data.get('role')
        
        if not new_role:
            return Response(
                {'error': 'Role is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if new_role not in dict(User.ROLE_CHOICES):
            return Response(
                {'error': 'Invalid role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Prevent users from changing their own role
        if user.id == request.user.id:
            return Response(
                {'error': 'You cannot change your own role'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.role = new_role
        user.save()
        
        return Response({
            'message': 'User role updated successfully',
            'user': UserSerializer(user).data
        })

    @action(detail=False, methods=['post'])
    def bulk_activate(self, request):
        """Activate multiple users"""
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response({
                'error': 'No user IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        users = User.objects.filter(id__in=user_ids)
        updated_count = users.update(is_active=True)
        
        return Response({
            'message': f'{updated_count} users activated successfully',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['post'])
    def bulk_deactivate(self, request):
        """Deactivate multiple users"""
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response({
                'error': 'No user IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent user from deactivating themselves
        if request.user.id in user_ids:
            user_ids.remove(request.user.id)
        
        users = User.objects.filter(id__in=user_ids)
        updated_count = users.update(is_active=False)
        
        return Response({
            'message': f'{updated_count} users deactivated successfully',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Delete multiple users"""
        user_ids = request.data.get('user_ids', [])
        
        if not user_ids:
            return Response({
                'error': 'No user IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent user from deleting themselves
        if request.user.id in user_ids:
            return Response({
                'error': 'You cannot delete your own account'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        users = User.objects.filter(id__in=user_ids)
        deleted_count = users.count()
        users.delete()
        
        return Response({
            'message': f'{deleted_count} users deleted successfully',
            'deleted_count': deleted_count
        })
    
    @action(detail=False, methods=['post'])
    def bulk_change_role(self, request):
        """Change role for multiple users"""
        user_ids = request.data.get('user_ids', [])
        new_role = request.data.get('role')
        
        if not user_ids or not new_role:
            return Response({
                'error': 'User IDs and role are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_role not in dict(User.ROLE_CHOICES):
            return Response({
                'error': 'Invalid role'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent user from changing their own role
        if request.user.id in user_ids:
            user_ids.remove(request.user.id)
        
        users = User.objects.filter(id__in=user_ids)
        updated_count = users.update(role=new_role)
        
        return Response({
            'message': f'{updated_count} users role updated to {new_role}',
            'updated_count': updated_count
        })
    
    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export users to CSV"""
        users = self.get_queryset()
        
        # Create the HttpResponse object with CSV header
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="users_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Username', 'Email', 'First Name', 'Last Name', 'Role', 'Organization', 'Active', 'Created At'])
        
        for user in users:
            writer.writerow([
                user.id,
                user.username,
                user.email,
                user.first_name,
                user.last_name,
                user.role,
                user.organization.name if user.organization else 'N/A',
                'Yes' if user.is_active else 'No',
                user.created_at.strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        return response
    
    @action(detail=False, methods=['get'])
    def export_json(self, request):
        """Export users to JSON"""
        users = self.get_queryset()
        serializer = self.get_serializer(users, many=True)
        
        response = HttpResponse(
            json.dumps(serializer.data, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="users_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
        
        return response
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get user statistics"""
        users = self.get_queryset()
        
        stats = {
            'total_users': users.count(),
            'active_users': users.filter(is_active=True).count(),
            'inactive_users': users.filter(is_active=False).count(),
            'by_role': {},
            'by_organization': {},
            'recent_users': users.order_by('-created_at')[:5].values(
                'id', 'username', 'email', 'first_name', 'last_name', 'created_at'
            )
        }
        
        # Count by role
        for role_code, role_name in User.ROLE_CHOICES:
            count = users.filter(role=role_code).count()
            if count > 0:
                stats['by_role'][role_name] = count
        
        # Count by organization
        from django.db.models import Count
        org_counts = users.values('organization__name').annotate(
            count=Count('id')
        ).order_by('-count')[:10]
        
        for item in org_counts:
            org_name = item['organization__name'] or 'No Organization'
            stats['by_organization'][org_name] = item['count']
        
        return Response(stats)


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


