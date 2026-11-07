"""Platform owner (CoreX) console: every customer account, approvals,
suspensions and hotel limits. Only users with role PLATFORM_ADMIN.

    GET   /api/tenants/platform/customers/            ?status=PENDING&search=taj
    POST  /api/tenants/platform/customers/            create a customer (active at once)
    GET   /api/tenants/platform/customers/{id}/       with its hotels and admins
    PATCH /api/tenants/platform/customers/{id}/       {property_limit}
    POST  /api/tenants/platform/customers/{id}/approve|suspend|reactivate|close/   {reason}
    GET   /api/tenants/platform/customers/summary/
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.activity.utils import log_activity
from apps.users.models import User

from .models import Organization
from .onboarding import create_customer, customer_admins, send_welcome_email, set_customer_status


def _invite_pending(user):
    """Created by invite and hasn't chosen a password yet."""
    return user.last_login is None and not user.has_usable_password()


class IsPlatformAdmin(BasePermission):
    message = 'Only the platform owner can do this.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'PLATFORM_ADMIN')


class CustomerCreateSerializer(serializers.Serializer):
    account_type = serializers.ChoiceField(choices=['STP', 'MSP'], default='STP')
    name = serializers.CharField(max_length=100)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    property_limit = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


def _row(org, admins, counts):
    return {
        'id': org.id, 'name': org.name, 'account_type': org.tenant_type, 'status': org.status,
        'status_reason': org.status_reason, 'status_changed_at': org.status_changed_at,
        'is_active': org.is_active, 'signed_up': org.signed_up, 'created_on': org.created_on,
        'property_limit': org.property_limit, 'property_count': counts.get(org.id, 0),
        'admin': next(({'name': a.get_full_name(), 'email': a.email, 'phone': a.phone,
                        'invite_pending': _invite_pending(a)}
                       for a in admins.get(org.id, [])), None),
    }


class PlatformCustomerViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def _customers(self):
        return Organization.objects.customers()

    def _get(self, pk):
        return self._customers().filter(pk=pk).first()

    def _rows(self, orgs):
        orgs = list(orgs)
        ids = [o.id for o in orgs]
        admins = {}
        for u in (User.objects.select_related('organization')
                  .filter(organization_id__in=ids, role__in=('MSP_ADMIN', 'STP_ADMIN')).order_by('date_joined')):
            admins.setdefault(u.organization.id, []).append(u)
        counts = {}
        for o in orgs:  # small lists (paged by status/search); keeps the rule in one place
            counts[o.id] = o.property_count()
        return [_row(o, admins, counts) for o in orgs]

    def list(self, request):
        qs = self._customers().order_by('-created_on')
        wanted = request.query_params.get('status')
        if wanted in dict(Organization.STATUS_CHOICES):
            qs = qs.filter(status=wanted)
        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(users__email__icontains=search)).distinct()
        return Response(self._rows(qs[:500]))

    def create(self, request):
        s = CustomerCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        org, _admin = create_customer(
            account_type=d['account_type'], name=d['name'].strip(), first_name=d['first_name'].strip(),
            last_name=d['last_name'].strip(), email=d['email'], phone=d.get('phone', ''),
            status='ACTIVE', property_limit=d.get('property_limit'),
        )
        log_activity(request, 'CREATE', obj=org, organization=org)
        return Response(self._rows([org])[0], status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        org = self._get(pk)
        if not org:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        data = self._rows([org])[0]
        if org.tenant_type == 'MSP':
            hotels = [{'id': o.id, 'name': o.name, 'kind': 'organization', 'is_active': o.is_active,
                       'status': o.status, 'rooms': o.n_rooms, 'created_on': o.created_on}
                      for o in org.sub_organizations.annotate(n_rooms=Count('rooms')).order_by('name')]
        else:
            hotels = [{'id': p.id, 'name': p.name, 'kind': 'property', 'is_active': p.is_active,
                       'status': None, 'rooms': p.n_rooms, 'created_on': p.created_at}
                      for p in org.properties.annotate(n_rooms=Count('rooms')).order_by('name')]
        member_ids = [org.id] + list(org.sub_organizations.values_list('id', flat=True))
        since = timezone.now() - timedelta(days=30)
        from apps.bookings.models import Booking
        data.update({
            'hotels': hotels,
            'admins': [{'name': a.get_full_name(), 'email': a.email, 'last_login': a.last_login,
                        'invite_pending': _invite_pending(a)}
                       for a in customer_admins(org)],
            'staff': User.objects.filter(organization_id__in=member_ids).exclude(role='CUSTOMER').count(),
            'bookings_30d': Booking.objects.filter(organization_id__in=member_ids, created_at__gte=since).count(),
        })
        return Response(data)

    def partial_update(self, request, pk=None):
        org = self._get(pk)
        if not org:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if 'property_limit' in request.data:
            raw = request.data.get('property_limit')
            if raw in (None, ''):
                limit = None
            else:
                try:
                    limit = int(raw)
                except (TypeError, ValueError):
                    limit = 0
                if limit < 1:
                    return Response({'property_limit': ['Enter 1 or more, or leave empty for no limit.']},
                                    status=status.HTTP_400_BAD_REQUEST)
            old = org.property_limit
            org.property_limit = limit
            org.save(update_fields=['property_limit', 'updated_on'])
            log_activity(request, 'UPDATE', obj=org, organization=org,
                         changes={'property_limit': [str(old or 'no limit'), str(limit or 'no limit')]})
        return Response(self._rows([org])[0])

    def _set(self, request, pk, new_status, allowed_from):
        org = self._get(pk)
        if not org:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if org.status not in allowed_from:
            return Response({'error': f'This account is {org.get_status_display().lower()}.'},
                            status=status.HTTP_400_BAD_REQUEST)
        set_customer_status(org, new_status, reason=str(request.data.get('reason') or ''), request=request)
        return Response(self._rows([org])[0])

    @action(detail=True, methods=['post'])
    def resend_welcome(self, request, pk=None):
        """Email the welcome / set-password link again to this customer's admins
        who haven't set a password yet. Never to anyone who has one: that would
        be a password reset nobody asked for."""
        org = self._get(pk)
        if not org:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        pending = [a for a in customer_admins(org) if _invite_pending(a)]
        if not pending:
            return Response({'error': 'Every admin has already set a password. '
                                      'They can use "Forgot password" on the sign-in page.'},
                            status=status.HTTP_400_BAD_REQUEST)
        sent = [a.email for a in pending if send_welcome_email(a)]
        failed = [a.email for a in pending if a.email not in sent]
        log_activity(request, 'UPDATE', obj=org, organization=org,
                     changes={'welcome_email': ['', f'resent to {", ".join(sent) or "nobody"}']})
        if not sent:
            return Response({'error': 'The email could not be sent. Check the email settings (EMAIL_HOST_PASSWORD).',
                             'failed': failed}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'sent': sent, 'failed': failed})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._set(request, pk, 'ACTIVE', ('PENDING',))

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        return self._set(request, pk, 'SUSPENDED', ('PENDING', 'ACTIVE'))

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        return self._set(request, pk, 'ACTIVE', ('SUSPENDED', 'CLOSED'))

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        return self._set(request, pk, 'CLOSED', ('PENDING', 'ACTIVE', 'SUSPENDED'))

    @action(detail=False, methods=['get'])
    def summary(self, request):
        counts = dict(self._customers().values_list('status').annotate(n=Count('id')).values_list('status', 'n'))
        since = timezone.now() - timedelta(days=30)
        return Response({
            'by_status': {s: counts.get(s, 0) for s, _ in Organization.STATUS_CHOICES},
            'total': sum(counts.values()),
            'new_30d': self._customers().filter(created_on__gte=since).count(),
            'live_hotels': Organization.objects.bookable().count(),
        })
