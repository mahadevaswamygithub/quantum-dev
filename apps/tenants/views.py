from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Organization
from .serializers import OrganizationSerializer, OrganizationCreateSerializer
from apps.users.models import User

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Green Admin can see all organizations
        if user.role == 'GREEN_ADMIN':
            return Organization.objects.all()
        
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
        from apps.users.serializers import UserSerializer
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def sub_organizations(self, request, pk=None):
        """Get sub-organizations for MSP"""
        organization = self.get_object()
        
        if organization.tenant_type != 'MSP':
            return Response(
                {'error': 'This organization is not an MSP'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sub_orgs = Organization.objects.filter(parent_organization=organization)
        serializer = OrganizationSerializer(sub_orgs, many=True)
        return Response(serializer.data)
    
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