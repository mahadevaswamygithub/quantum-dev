import csv
from datetime import datetime
import io
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
from apps.core.permissions import get_visible_organization_ids
from apps.users.models import User
from apps.users.serializers import UserSerializer
import logging

logger = logging.getLogger(__name__)

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Organization.objects.order_by('-created_on')

        if user.role in ('MSP_ADMIN', 'MSP_USER', 'STP_ADMIN', 'STP_USER'):
            # MSP sees its sub-orgs only (not itself); STP sees its own org.
            org_ids = get_visible_organization_ids(user, include_own_org=False)
            return qs.filter(id__in=org_ids)
        return qs.none()
 
    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer
 
    def create(self, request):
        serializer = OrganizationCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            org = serializer.save()
            return Response(OrganizationSerializer(org).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
    @action(detail=True, methods=['get'], url_path='users')
    def users(self, request, pk=None):
        org = self.get_object()
        users = User.objects.filter(organization=org).order_by('-created_at')
        return Response(UserSerializer(users, many=True, context={'request': request}).data)
 
    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        org = self.get_object()
        users = User.objects.filter(organization=org)
        return Response({
            'total_users': users.count(),
            'active_users': users.filter(is_active=True).count(),
            'inactive_users': users.filter(is_active=False).count(),
            'admins': users.filter(role__contains='ADMIN').count(),
            'regular_users': users.exclude(role__contains='ADMIN').count(),
        })
 
    @action(detail=True, methods=['post'], url_path='toggle_status')
    def toggle_status(self, request, pk=None):
        org = self.get_object()
        org.is_active = not org.is_active
        org.save()
        return Response({'is_active': org.is_active})
 
    @action(detail=False, methods=['post'], url_path='bulk_activate')
    def bulk_activate(self, request):
        ids = request.data.get('org_ids', [])
        Organization.objects.filter(id__in=ids).update(is_active=True)
        return Response({'message': f'{len(ids)} organizations activated'})
 
    @action(detail=False, methods=['post'], url_path='bulk_deactivate')
    def bulk_deactivate(self, request):
        ids = request.data.get('org_ids', [])
        Organization.objects.filter(id__in=ids).update(is_active=False)
        return Response({'message': f'{len(ids)} organizations deactivated'})
 
    @action(detail=False, methods=['get'], url_path='export_csv')
    def export_csv(self, request):
        qs = self.get_queryset()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Name', 'Type', 'Schema', 'Active', 'Users', 'Created'])
        for o in qs:
            writer.writerow([
                o.id, o.name, o.tenant_type, o.schema_name,
                o.is_active, User.objects.filter(organization=o).count(),
                o.created_on.strftime('%Y-%m-%d')
            ])
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="organizations.csv"'
        return response
 
    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'active': qs.filter(is_active=True).count(),
            'inactive': qs.filter(is_active=False).count(),
            'msp': qs.filter(tenant_type='MSP').count(),
            'stp': qs.filter(tenant_type='STP').count(),
        })