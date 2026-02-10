import csv
from datetime import datetime
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Count
from .models import Organization, Domain
from .serializers import (
    OrganizationSerializer, 
    OrganizationDetailSerializer,
    OrganizationCreateSerializer,
    OrganizationUpdateSerializer
)
from apps.users.models import User
from apps.users.serializers import UserSerializer
import logging

logger = logging.getLogger(__name__)

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OrganizationUpdateSerializer
        elif self.action == 'retrieve':
            return OrganizationDetailSerializer
        return OrganizationSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Green Admin can see all organizations except public
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
    
    def create(self, request, *args, **kwargs):
        logger.info(f"Creating organization: {request.data}")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()
        
        return Response({
            'message': 'Organization created successfully',
            'organization': OrganizationSerializer(organization).data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()
        
        return Response({
            'message': 'Organization updated successfully',
            'organization': OrganizationSerializer(organization).data
        })
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Prevent deletion of organization if it has users
        user_count = User.objects.filter(organization=instance).count()
        if user_count > 0:
            return Response({
                'error': f'Cannot delete organization with {user_count} users. Please remove all users first.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent deletion if it's a parent organization with sub-orgs
        if instance.tenant_type == 'MSP':
            sub_org_count = Organization.objects.filter(parent_organization=instance).count()
            if sub_org_count > 0:
                return Response({
                    'error': f'Cannot delete MSP with {sub_org_count} sub-organizations. Please remove all sub-organizations first.'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        instance.delete()
        return Response({
            'message': 'Organization deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)
    
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
            stats['sub_organizations_active'] = Organization.objects.filter(
                parent_organization=organization,
                is_active=True
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
            'is_active': organization.is_active,
            'organization': OrganizationSerializer(organization).data
        })

    @action(detail=False, methods=['post'])
    def bulk_activate(self, request):
        """Activate multiple organizations"""
        org_ids = request.data.get('org_ids', [])
        
        if not org_ids:
            return Response({
                'error': 'No organization IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        orgs = Organization.objects.filter(id__in=org_ids)
        updated_count = orgs.update(is_active=True)
        
        return Response({
            'message': f'{updated_count} organizations activated successfully',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['post'])
    def bulk_deactivate(self, request):
        """Deactivate multiple organizations"""
        org_ids = request.data.get('org_ids', [])
        
        if not org_ids:
            return Response({
                'error': 'No organization IDs provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        orgs = Organization.objects.filter(id__in=org_ids)
        updated_count = orgs.update(is_active=False)
        
        return Response({
            'message': f'{updated_count} organizations deactivated successfully',
            'updated_count': updated_count
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export organizations to CSV"""
        orgs = self.get_queryset()
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="organizations_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['ID', 'Name', 'Schema', 'Type', 'Parent', 'Active', 'Users', 'Created At'])
        
        for org in orgs:
            writer.writerow([
                org.id,
                org.name,
                org.schema_name,
                org.tenant_type,
                org.parent_organization.name if org.parent_organization else 'None',
                'Yes' if org.is_active else 'No',
                User.objects.filter(organization=org).count(),
                org.created_on.strftime('%Y-%m-%d %H:%M:%S')
            ])
        
        return response

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get organization statistics"""
        orgs = self.get_queryset()
        
        stats = {
            'total_organizations': orgs.count(),
            'active_organizations': orgs.filter(is_active=True).count(),
            'inactive_organizations': orgs.filter(is_active=False).count(),
            'msp_count': orgs.filter(tenant_type='MSP').count(),
            'stp_count': orgs.filter(tenant_type='STP').count(),
            'total_users': User.objects.filter(organization__in=orgs).count(),
            'avg_users_per_org': 0,
        }
        
        if stats['total_organizations'] > 0:
            stats['avg_users_per_org'] = round(
                stats['total_users'] / stats['total_organizations'], 2
            )
        
        return Response(stats)