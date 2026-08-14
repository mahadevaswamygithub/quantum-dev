import csv
from datetime import datetime, timedelta
import io
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Q, Count
from .models import Organization, Domain
from .serializers import (
    OrganizationSerializer,
    OrganizationDetailSerializer,
    OrganizationCreateSerializer,
    OrganizationUpdateSerializer
)
from apps.core.permissions import get_visible_organization_ids
from apps.users.models import User, ImpersonationToken
from apps.users.serializers import UserSerializer
from apps.activity.utils import log_activity, diff_fields
import logging

logger = logging.getLogger(__name__)

# Fields worth recording on an Organization UPDATE — matches
# OrganizationUpdateSerializer.Meta.fields exactly.
_ORG_TRACKED_FIELDS = ['name', 'is_active', 'org_type', 'latitude', 'longitude']

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        # public_info/public_list are the deliberately anonymous-accessible
        # actions — a customer visiting the shared booking page has no
        # account yet, so they can't require IsAuthenticated like every
        # other action here.
        if self.action in ('public_info', 'public_list'):
            return [AllowAny()]
        return super().get_permissions()

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
        if self.action in ('update', 'partial_update'):
            return OrganizationUpdateSerializer
        return OrganizationSerializer
 
    def create(self, request):
        serializer = OrganizationCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            org = serializer.save()
            log_activity(request, 'CREATE', obj=org, organization=org)
            return Response(OrganizationSerializer(org).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        instance = serializer.instance
        changes = diff_fields(instance, serializer.validated_data, _ORG_TRACKED_FIELDS)
        org = serializer.save()
        if changes:
            log_activity(self.request, 'UPDATE', obj=org, organization=org, changes=changes)

    def perform_destroy(self, instance):
        log_activity(self.request, 'DELETE', obj=instance, organization=instance)
        instance.delete()

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
 
    @action(detail=True, methods=['get'], url_path='public_info')
    def public_info(self, request, pk=None):
        """Anonymous-accessible — see get_permissions(). Deliberately does
        NOT use get_object()/get_queryset(): those scope by the requesting
        user's own visible orgs, which doesn't apply to an anonymous
        visitor at all. Returns only {id, name, org_type}, and only for an
        active ROOM_BOOKING STP org, so this can't be used to probe
        arbitrary org IDs/names/MSP data."""
        org = Organization.objects.filter(
            pk=pk, tenant_type='STP', org_type='ROOM_BOOKING', is_active=True,
        ).first()
        if not org:
            return Response({'error': 'Not found or not accepting bookings.'}, status=status.HTTP_404_NOT_FOUND)
        logo = request.build_absolute_uri(org.logo.url) if org.logo else None
        return Response({'id': org.id, 'name': org.name, 'org_type': org.org_type, 'logo': logo})

    @action(detail=False, methods=['get'], url_path='public_list')
    def public_list(self, request):
        """Anonymous-accessible — backs the shared /book landing page,
        where a visitor picks which business they're booking with instead
        of needing an org-specific link/ID. Same field allowlist as
        public_info, same ROOM_BOOKING-STP-active filter — a visitor here
        never sees anything beyond {id, name, org_type} for organizations
        that are actually open for booking."""
        orgs = Organization.objects.filter(
            tenant_type='STP', org_type='ROOM_BOOKING', is_active=True,
        ).order_by('name')
        return Response([
            {
                'id': o.id, 'name': o.name, 'org_type': o.org_type,
                'logo': request.build_absolute_uri(o.logo.url) if o.logo else None,
            }
            for o in orgs
        ])

    @action(detail=True, methods=['post'], url_path='upload_logo')
    def upload_logo(self, request, pk=None):
        org = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        org.logo = request.FILES['file']
        org.save()
        return Response(OrganizationSerializer(org, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='toggle_status')
    def toggle_status(self, request, pk=None):
        org = self.get_object()
        was_active = org.is_active
        org.is_active = not org.is_active
        org.save()
        log_activity(request, 'UPDATE', obj=org, organization=org, changes={'is_active': [str(was_active), str(org.is_active)]})
        return Response({'is_active': org.is_active})

    @action(detail=True, methods=['post'], url_path='impersonate')
    def impersonate(self, request, pk=None):
        if request.user.role != 'MSP_ADMIN':
            return Response({'error': 'Only an MSP admin can impersonate an organization.'}, status=status.HTTP_403_FORBIDDEN)

        # get_object() already restricts to get_visible_organization_ids(request.user) via get_queryset()
        org = self.get_object()
        if org.tenant_type != 'STP':
            return Response({'error': 'Only STP organizations can be impersonated.'}, status=status.HTTP_400_BAD_REQUEST)

        target = User.objects.filter(
            organization=org, role='STP_ADMIN', is_active=True
        ).order_by('date_joined').first()
        if not target:
            return Response({'error': 'This organization has no admin user.'}, status=status.HTTP_400_BAD_REQUEST)

        token = ImpersonationToken.objects.create(
            target_user=target,
            initiated_by=request.user,
            organization=org,
            expires_at=timezone.now() + timedelta(seconds=60),
        )
        return Response({'code': str(token.code)})

    @action(detail=False, methods=['post'], url_path='bulk_activate')
    def bulk_activate(self, request):
        ids = request.data.get('org_ids', [])
        orgs = list(Organization.objects.filter(id__in=ids))
        Organization.objects.filter(id__in=ids).update(is_active=True)
        # One log row per org (not one for the whole batch) so it shows up
        # correctly scoped in that org's own activity view too.
        for org in orgs:
            log_activity(request, 'UPDATE', obj=org, organization=org, changes={'is_active': ['False', 'True']})
        return Response({'message': f'{len(ids)} organizations activated'})

    @action(detail=False, methods=['post'], url_path='bulk_deactivate')
    def bulk_deactivate(self, request):
        ids = request.data.get('org_ids', [])
        orgs = list(Organization.objects.filter(id__in=ids))
        Organization.objects.filter(id__in=ids).update(is_active=False)
        for org in orgs:
            log_activity(request, 'UPDATE', obj=org, organization=org, changes={'is_active': ['True', 'False']})
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