import csv
from datetime import timedelta
import io
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import Count
from .models import Organization
from .serializers import (
    OrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationUpdateSerializer,
    OwnOrganizationSerializer,
    OrgEmailSettingsSerializer,
)
from apps.core.permissions import get_visible_organization_ids
from apps.users.models import User, ImpersonationToken
from apps.core.access import has_perm
from apps.bookings.models import Booking
from apps.users.serializers import UserSerializer
from apps.activity.utils import log_activity, diff_fields
import logging

logger = logging.getLogger(__name__)

# Fields worth recording on an Organization UPDATE - matches
# OrganizationUpdateSerializer.Meta.fields exactly.
_ORG_TRACKED_FIELDS = ['name', 'is_active', 'org_type', 'latitude', 'longitude']
_OWN_ORG_TRACKED_FIELDS = ['name', 'contact_email', 'contact_phone', 'address', 'latitude', 'longitude']
ORG_ADMIN_ROLES = ('MSP_ADMIN', 'STP_ADMIN')
COVER_MAX_BYTES = 5 * 1024 * 1024
ORG_STAFF_ROLES = ('MSP_ADMIN', 'MSP_USER', 'STP_ADMIN', 'STP_USER')


def _rating_summary(org_ids):
    """{org_id: {'rating_avg': 4.3, 'rating_count': 12}} for the public pages."""
    from apps.bookings.public_stays import _rating_summary as summary
    return summary(org_ids)


def _redis_reachable():
    """Best-effort ping of the Celery broker, with a short timeout so the
    Settings page never hangs the way a Celery .delay() does when Redis is down."""
    try:
        import redis
        from django.conf import settings
        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        return bool(client.ping())
    except Exception:
        return False

class OrganizationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    # What each action needs (apps.core.access). MSP staff work on client
    # organizations; STP staff only read their own and use the `mine` actions.
    MSP_ACTION_PERMS = {
        'list': 'organizations.view', 'retrieve': 'organizations.view', 'users': 'organizations.view',
        'stats': 'organizations.view', 'export_csv': 'organizations.view', 'statistics': 'organizations.view',
        'create': 'organizations.manage', 'update': 'organizations.manage', 'partial_update': 'organizations.manage',
        'destroy': 'organizations.manage', 'upload_logo': 'organizations.manage', 'toggle_status': 'organizations.manage',
        'bulk_activate': 'organizations.manage', 'bulk_deactivate': 'organizations.manage',
        'impersonate': 'organizations.impersonate', 'platform_status': 'platform.view',
        'overview': 'organizations.view',
    }
    STP_READ_ACTIONS = {'list', 'retrieve', 'users', 'stats', 'statistics'}
    OPEN_ACTIONS = {'public_info', 'public_list', 'mine', 'mine_logo', 'mine_cover', 'mine_email', 'mine_email_test'}  # checked inside

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in self.OPEN_ACTIONS:
            return
        role = getattr(request.user, 'role', None)
        if role in ('MSP_ADMIN', 'MSP_USER'):
            needed = self.MSP_ACTION_PERMS.get(self.action)
            if needed and has_perm(request.user, needed):
                return
        elif role in ('STP_ADMIN', 'STP_USER') and self.action in self.STP_READ_ACTIONS:
            return
        raise PermissionDenied('Your role doesn’t allow this.')

    def get_permissions(self):
        # public_info/public_list are the deliberately anonymous-accessible
        # actions - a customer visiting the shared booking page has no
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
        users = User.objects.filter(organization=org).exclude(role='CUSTOMER').order_by('-created_at')
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
        """Anonymous-accessible - see get_permissions(). Deliberately does
        NOT use get_object()/get_queryset(): those scope by the requesting
        user's own visible orgs, which doesn't apply to an anonymous
        visitor at all. Returns only {id, name, org_type}, and only for an
        active ROOM_BOOKING STP org, so this can't be used to probe
        arbitrary org IDs/names/MSP data."""
        org = Organization.objects.bookable().filter(pk=pk).first()
        if not org:
            return Response({'error': 'Not found or not accepting bookings.'}, status=status.HTTP_404_NOT_FOUND)
        from apps.bookings.models import BookingSettings
        from apps.bookings.razorpay_client import get_client
        logo = request.build_absolute_uri(org.logo.url) if org.logo else None
        rules = BookingSettings.for_org(org)
        return Response({
            'id': org.id, 'name': org.name, 'org_type': org.org_type, 'logo': logo,
            'cover_image': request.build_absolute_uri(org.cover_image.url) if org.cover_image else None,
            'contact_email': org.contact_email, 'contact_phone': org.contact_phone, 'address': org.address,
            'accepting_bookings': rules.accepting_bookings,
            'auto_confirm': rules.auto_confirm,
            'free_cancellation_hours': rules.free_cancellation_hours,
            'check_in_time': rules.check_in_time.strftime('%H:%M'),
            'check_out_time': rules.check_out_time.strftime('%H:%M'),
            'cancellation_policy': rules.cancellation_policy,
            'online_payments': get_client() is not None,
            **_rating_summary([org.id]).get(org.id, {'rating_avg': None, 'rating_count': 0}),
        })

    @action(detail=False, methods=['get'], url_path='public_list')
    def public_list(self, request):
        """Anonymous-accessible - backs the shared /book site (landing page
        and stay search). Lists active ROOM_BOOKING STP orgs that have at
        least one bookable room, with only public-facing details.

        Optional ?check_in=&check_out= adds `available_rooms` (rooms free
        for that stay) and ?guests= only counts rooms big enough."""
        from apps.bookings.public_stays import public_stays
        from apps.bookings.views import _requested_stay
        check_in, check_out = _requested_stay(request)
        guests = request.query_params.get('guests')
        return Response(public_stays(
            request.build_absolute_uri, check_in, check_out,
            int(guests) if guests and guests.isdigit() else None,
        ))

    @action(detail=False, methods=['get', 'patch'], url_path='mine')
    def mine(self, request):
        """The requesting user's own organization - any MSP/STP staff can
        read it, only that org's admin can edit it."""
        user = request.user
        org = user.organization
        if user.role not in ORG_STAFF_ROLES or not org:
            return Response({'error': 'No organization.'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'GET':
            return Response(OwnOrganizationSerializer(org, context={'request': request}).data)
        if not has_perm(user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow changing organization settings.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = OwnOrganizationSerializer(org, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        changes = diff_fields(org, serializer.validated_data, _OWN_ORG_TRACKED_FIELDS)
        org = serializer.save()
        if changes:
            log_activity(request, 'UPDATE', obj=org, organization=org, changes=changes)
        return Response(OwnOrganizationSerializer(org, context={'request': request}).data)

    @action(detail=False, methods=['post'], url_path='mine/logo')
    def mine_logo(self, request):
        user = request.user
        if not user.organization or not has_perm(user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow changing the logo.'}, status=status.HTTP_403_FORBIDDEN)
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        org = user.organization
        org.logo = request.FILES['file']
        org.save(update_fields=['logo', 'updated_on'])
        return Response(OwnOrganizationSerializer(org, context={'request': request}).data)

    @action(detail=False, methods=['post', 'delete'], url_path='mine/cover')
    def mine_cover(self, request):
        """Upload (POST, multipart `file`) or remove (DELETE) the org's cover photo."""
        user = request.user
        if not user.organization or not has_perm(user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow changing the cover photo.'}, status=status.HTTP_403_FORBIDDEN)
        org = user.organization
        if request.method == 'DELETE':
            if org.cover_image:
                org.cover_image.delete(save=False)
            org.cover_image = None
        else:
            upload = request.FILES.get('file')
            if not upload:
                return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
            if upload.size > COVER_MAX_BYTES:
                return Response({'error': 'Cover photo must be 5 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)
            from django.core.exceptions import ValidationError
            from django.forms import ImageField as ImageFormField
            try:
                ImageFormField().clean(upload)  # rejects files that aren't real images
            except ValidationError:
                return Response({'error': 'That file isn’t a valid image.'}, status=status.HTTP_400_BAD_REQUEST)
            upload.seek(0)
            org.cover_image = upload
        org.save(update_fields=['cover_image', 'updated_on'])
        log_activity(request, 'UPDATE', obj=org, organization=org,
                     changes={'cover_image': ['', 'removed' if request.method == 'DELETE' else 'updated']})
        return Response(OwnOrganizationSerializer(org, context={'request': request}).data)

    @action(detail=False, methods=['get', 'patch'], url_path='mine/email')
    def mine_email(self, request):
        """Settings → Email: how this organization's emails to guests are sent."""
        from .models import OrgEmailSettings
        user = request.user
        if not user.organization or not has_perm(user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow changing email settings.'}, status=status.HTTP_403_FORBIDDEN)
        cfg = OrgEmailSettings.for_org(user.organization)
        if request.method == 'GET':
            return Response(OrgEmailSettingsSerializer(cfg).data)
        serializer = OrgEmailSettingsSerializer(cfg, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_activity(request, 'UPDATE', obj=user.organization, organization=user.organization,
                     changes={'email_settings': ['', f"mode={cfg.mode}, guest emails {'on' if cfg.send_booking_emails else 'off'}"]})
        return Response(OrgEmailSettingsSerializer(cfg).data)

    @action(detail=False, methods=['post'], url_path='mine/email/test')
    def mine_email_test(self, request):
        """Send a test email to the requester using the saved settings - no
        fallback, so a broken account shows up here rather than in production."""
        from apps.core.email import build_org_message
        from .models import OrgEmailSettings
        user = request.user
        if not user.organization or not has_perm(user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow this.'}, status=status.HTTP_403_FORBIDDEN)
        org = user.organization
        cfg = OrgEmailSettings.for_org(org)
        try:
            build_org_message(org, f'Test email from {org.name}',
                              f"This is a test from {org.name}'s email settings on CoreX.\n\n"
                              "If you're reading this, guests will receive booking emails the same way.\n",
                              user.email).send()
            ok, error = True, ''
        except Exception as exc:  # report the real reason (auth failed, wrong port, …)
            ok, error = False, f'{type(exc).__name__}: {exc}'[:300]
        cfg.last_test_at, cfg.last_test_ok, cfg.last_test_error = timezone.now(), ok, error
        cfg.save(update_fields=['last_test_at', 'last_test_ok', 'last_test_error', 'updated_at'])
        if not ok:
            return Response({'error': f'Sending failed - {error}', **OrgEmailSettingsSerializer(cfg).data},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': f'Test email sent to {user.email}.', **OrgEmailSettingsSerializer(cfg).data})

    @action(detail=False, methods=['get'], url_path='overview')
    def overview(self, request):
        """MSP: how each managed room-booking organization is doing - rooms,
        tonight's occupancy, this month's bookings and revenue, open requests,
        last booking, and a simple health flag."""
        import datetime as dt
        from decimal import Decimal
        from zoneinfo import ZoneInfo
        from django.conf import settings as dj_settings
        from django.db.models import Max, Q, Sum
        from apps.bookings.models import Booking, Payment, Room

        tz = ZoneInfo(getattr(dj_settings, 'PROPERTY_TIMEZONE', 'Asia/Kolkata'))
        now = dt.datetime.now(tz)
        today = now.date()
        month_start = dt.datetime.combine(today.replace(day=1), dt.time.min, tzinfo=tz)
        orgs = list(self.get_queryset().filter(tenant_type='STP'))
        ids = [o.id for o in orgs]
        rooms = dict(Room.objects.filter(organization_id__in=ids, is_active=True)
                     .values('organization_id').annotate(n=Count('id')).values_list('organization_id', 'n'))
        occupied = dict(Booking.objects.filter(organization_id__in=ids, status__in=['CONFIRMED', 'CHECKED_IN'],
                                               check_in__lte=today, check_out__gt=today)
                        .values('organization_id').annotate(n=Count('room_id', distinct=True)).values_list('organization_id', 'n'))
        stats = {r['organization_id']: r for r in Booking.objects.filter(organization_id__in=ids).values('organization_id').annotate(
            month=Count('id', filter=Q(created_at__gte=month_start)),
            pending=Count('id', filter=Q(status='PENDING', payment_method='AT_PROPERTY')),
            cancel_requests=Count('id', filter=Q(cancel_request_status='PENDING')),
            last=Max('created_at'))}
        revenue = dict(Payment.objects.filter(booking__organization_id__in=ids, status='PAID', paid_at__gte=month_start)
                       .values('booking__organization_id').annotate(s=Sum('amount')).values_list('booking__organization_id', 's'))
        users = dict(User.objects.filter(organization_id__in=ids, is_active=True)
                     .values('organization_id').annotate(n=Count('id')).values_list('organization_id', 'n'))
        rows = []
        for o in orgs:
            st = stats.get(o.id, {})
            n_rooms = rooms.get(o.id, 0)
            last = st.get('last')
            if not o.is_active:
                health = 'inactive'
            elif not n_rooms:
                health = 'setup'
            elif not last or last < now - dt.timedelta(days=30):
                health = 'quiet'
            elif st.get('cancel_requests') or st.get('pending'):
                health = 'attention'
            else:
                health = 'good'
            rows.append({
                'id': o.id, 'name': o.name, 'is_active': o.is_active, 'org_type': o.org_type,
                'logo': request.build_absolute_uri(o.logo.url) if o.logo else None,
                'rooms': n_rooms, 'occupied_tonight': occupied.get(o.id, 0),
                'occupancy': round(occupied.get(o.id, 0) * 100 / n_rooms) if n_rooms else 0,
                'bookings_month': st.get('month', 0), 'revenue_month': str(revenue.get(o.id) or Decimal('0')),
                'pending': st.get('pending', 0), 'cancel_requests': st.get('cancel_requests', 0),
                'last_booking': last.isoformat() if last else None, 'users': users.get(o.id, 0), 'health': health,
            })
        total_rooms = sum(rooms.values())
        return Response({
            'totals': {
                'organizations': len(orgs), 'active': sum(1 for o in orgs if o.is_active), 'rooms': total_rooms,
                'occupied_tonight': sum(occupied.values()),
                'occupancy': round(sum(occupied.values()) * 100 / total_rooms) if total_rooms else 0,
                'bookings_month': sum(r['bookings_month'] for r in rows),
                'revenue_month': str(sum((Decimal(r['revenue_month']) for r in rows), Decimal('0'))),
                'needs_attention': sum(1 for r in rows if r['health'] in ('attention', 'setup', 'quiet')),
            },
            'organizations': sorted(rows, key=lambda r: -Decimal(r['revenue_month'])),
        })

    @action(detail=False, methods=['get'], url_path='platform_status')
    def platform_status(self, request):
        """Settings → Platform (MSP admin): a summary of the orgs it manages
        plus whether the integrations the product depends on are set up."""
        from django.conf import settings
        if not has_perm(request.user, 'platform.view'):
            return Response({'error': 'Your role doesn’t allow this.'}, status=status.HTTP_403_FORBIDDEN)
        orgs = self.get_queryset()
        org_ids = list(orgs.values_list('id', flat=True))
        by_type = dict(
            orgs.exclude(org_type__isnull=True).values_list('org_type').annotate(n=Count('id')).values_list('org_type', 'n')
        )
        return Response({
            'organizations': {
                'total': len(org_ids),
                'active': orgs.filter(is_active=True).count(),
                'by_type': by_type,
                'missing_type': orgs.filter(tenant_type='STP', org_type__isnull=True).count(),
            },
            'users': User.objects.filter(organization_id__in=org_ids).exclude(role='CUSTOMER').count(),
            # Distinct guests who have booked with any of these organizations.
            'customers': Booking.objects.filter(organization_id__in=org_ids).values('customer_id').distinct().count(),
            'integrations': {
                'payments': bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET),
                'email': bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD),
                'background_tasks': _redis_reachable(),
            },
        })

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
        if not has_perm(request.user, 'organizations.impersonate'):
            return Response({'error': 'Your role doesn’t allow logging in as an organization.'}, status=status.HTTP_403_FORBIDDEN)

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
        orgs = list(self.get_queryset().filter(id__in=ids))  # only orgs this user manages
        Organization.objects.filter(id__in=[o.id for o in orgs]).update(is_active=True)
        # One log row per org (not one for the whole batch) so it shows up
        # correctly scoped in that org's own activity view too.
        for org in orgs:
            log_activity(request, 'UPDATE', obj=org, organization=org, changes={'is_active': ['False', 'True']})
        return Response({'message': f'{len(ids)} organizations activated'})

    @action(detail=False, methods=['post'], url_path='bulk_deactivate')
    def bulk_deactivate(self, request):
        ids = request.data.get('org_ids', [])
        orgs = list(self.get_queryset().filter(id__in=ids))  # only orgs this user manages
        Organization.objects.filter(id__in=[o.id for o in orgs]).update(is_active=False)
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