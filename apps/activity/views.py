from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.core.access import has_perm
from apps.core.permissions import OrganizationScopedQuerysetMixin
from .models import ActivityLog
from .serializers import ActivityLogSerializer

# Matches other list endpoints in this codebase (UserViewSet.list,
# OrganizationViewSet) which return a plain array with no DRF pagination -
# kept consistent here, just capped so a busy org can't return an unbounded
# payload.
MAX_RESULTS = 300


class ActivityLogViewSet(OrganizationScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only - rows are written exclusively by log_activity(), never
    through this API. Audit-trail visibility is admin-only: MSP_ADMIN sees
    activity across their own org + sub-orgs, STP_ADMIN sees their own
    org's activity only. Non-admin roles get nothing (this is an admin
    feature, not a general activity feed).
    """
    serializer_class = ActivityLogSerializer
    permission_classes = [IsAuthenticated]
    organization_lookup = 'organization'

    def get_queryset(self):
        user = self.request.user
        if not has_perm(user, 'activity.view'):
            return ActivityLog.objects.none()

        # Staff audit trail only. Guests' actions on a booking (booked,
        # cancelled, paid) stay on that booking's own timeline instead.
        qs = self.get_organization_scoped_queryset(
            ActivityLog.objects.select_related('organization')
        ).exclude(actor_role='CUSTOMER')

        params = self.request.query_params
        action = params.get('action')
        if action:
            qs = qs.filter(action=action)
        model_name = params.get('model_name')
        if model_name:
            qs = qs.filter(model_name=model_name)
        search = params.get('search')
        if search:
            qs = qs.filter(Q(actor_username__icontains=search) | Q(object_repr__icontains=search))
        date_from = params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        date_to = params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs.order_by('-created_at')[:MAX_RESULTS]
