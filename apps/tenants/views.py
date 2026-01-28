from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from .models import Organization
from .serializers import OrganizationSerializer, OrganizationDetailSerializer
from apps.users.models import User
from apps.users.serializers import UserSerializer

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return OrganizationDetailSerializer
        return OrganizationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Green Admin can see all organizations
        if user.role == 'GREEN_ADMIN':
            return Organization.objects.exclude(schema_name='public')
        
        # MSP users can see their organization and sub-organizations
        elif user.role in ['MSP_ADMIN', 'MSP_USER']:
            return Organization.objects.filter(
                Q(id=user.organization.id) |
                Q(parent_organization=user.organization)
            )
        
        # STP users can only see their organization
        else:
            return Organization.objects.filter(id=user.organization.id)
    
    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users for a specific organization"""
        organization = self.get_object()
        users = User.objects.filter(organization=organization)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get statistics for a specific organization"""
        organization = self.get_object()
        
        users = User.objects.filter(organization=organization)
        active_users = users.filter(is_active=True).count()
        
        stats = {
            'total_users': users.count(),
            'active_users': active_users,
            'inactive_users': users.count() - active_users,
            'admins': users.filter(role__contains='ADMIN').count(),
            'regular_users': users.exclude(role__contains='ADMIN').count(),
        }
        
        # For MSP, include sub-organization count
        if organization.tenant_type == 'MSP':
            stats['sub_organizations'] = Organization.objects.filter(
                parent_organization=organization
            ).count()
        
        return Response(stats)
    
    @action(detail=True, methods=['post'])
    def toggle_status(self, request, pk=None):
        """Activate or deactivate an organization"""
        organization = self.get_object()
        organization.is_active = not organization.is_active
        organization.save()
        
        return Response({
            'message': f'Organization {"activated" if organization.is_active else "deactivated"}',
            'is_active': organization.is_active
        })