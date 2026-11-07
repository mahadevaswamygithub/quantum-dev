"""Settings → Roles & access: an organization's staff roles."""
from django.db.models import Count, ProtectedError
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.activity.utils import log_activity
from apps.core.access import ADMIN_TIERS, catalog_for, codes_for, has_perm
from ..models import OrgRole


class OrgRoleSerializer(serializers.ModelSerializer):
    user_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrgRole
        fields = ['id', 'name', 'description', 'permissions', 'is_preset', 'user_count', 'updated_at']
        read_only_fields = ['id', 'is_preset', 'user_count', 'updated_at']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Give the role a name.')
        org = self.context['organization']
        clash = OrgRole.objects.filter(organization=org, name__iexact=value)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError('A role with this name already exists.')
        return value

    def validate_permissions(self, value):
        allowed = codes_for(self.context['organization'])
        unknown = [p for p in value if p not in allowed]
        if unknown:
            raise serializers.ValidationError(f"Not available for this organization: {', '.join(unknown)}")
        # "Manage" implies "view" for the same area - keep the stored list consistent.
        implied = {'bookings.manage': 'bookings.view', 'rooms.manage': 'rooms.view', 'users.manage': 'users.view',
                   'organizations.manage': 'organizations.view', 'payments.refund': 'bookings.view'}
        out = set(value)
        out |= {implied[p] for p in value if p in implied}
        return sorted(out & allowed)


class OrgRoleViewSet(viewsets.ModelViewSet):
    """The requesting staff member's organization's roles.
    Anyone who can view users may list them (to see who can do what);
    only the organization's admins can create, edit or delete them."""
    serializer_class = OrgRoleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def _org(self):
        """The requester's own organization, or - for reading only - one they
        can see (?organization=<id>), so an MSP adding a user to a client org
        can pick from that org's roles."""
        own = getattr(self.request.user, 'organization', None)
        wanted = self.request.query_params.get('organization')
        if self.request.method == 'GET' and wanted and wanted.isdigit() and own and int(wanted) != own.id:
            from apps.core.permissions import get_visible_organization_ids
            from apps.tenants.models import Organization
            if int(wanted) in (get_visible_organization_ids(self.request.user, include_own_org=True) or []):
                return Organization.objects.filter(pk=wanted).first()
            return None
        return own

    def get_queryset(self):
        org = self._org()
        user = self.request.user
        if not org or not (user.role in ADMIN_TIERS or has_perm(user, 'users.view')):
            return OrgRole.objects.none()
        return OrgRole.objects.filter(organization=org).annotate(user_count=Count('users'))

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'organization': self._org()}

    def _admin_or_403(self):
        if self.request.user.role not in ADMIN_TIERS:
            return Response({'error': 'Only an organization admin can change roles.'}, status=status.HTTP_403_FORBIDDEN)
        return None

    def create(self, request, *args, **kwargs):
        return self._admin_or_403() or super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        return self._admin_or_403() or super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._admin_or_403()
        if denied:
            return denied
        role = self.get_object()
        try:
            log_activity(request, 'DELETE', obj=role, organization=role.organization)
            role.delete()
        except ProtectedError:
            return Response({'error': f'{role.users.count()} user(s) still have the “{role.name}” role. '
                                      'Give them another role first.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_create(self, serializer):
        role = serializer.save(organization=self._org())
        log_activity(self.request, 'CREATE', obj=role, organization=role.organization)

    def perform_update(self, serializer):
        before = sorted(serializer.instance.permissions or [])
        role = serializer.save()
        changes = {'permissions': [', '.join(before), ', '.join(role.permissions)]} if before != role.permissions else None
        log_activity(self.request, 'UPDATE', obj=role, organization=role.organization, changes=changes)

    @action(detail=False, methods=['get'], url_path='catalog')
    def catalog(self, request):
        """Permission sections that apply to this organization, for the role editor."""
        org = self._org()
        if not org:
            return Response([])
        return Response([
            {'key': s['key'], 'label': s['label'], 'perms': [{'code': c, 'label': l} for c, l in s['perms']]}
            for s in catalog_for(org)
        ])
