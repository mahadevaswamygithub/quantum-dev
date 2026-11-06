import json
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from razorpay.errors import SignatureVerificationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.access import has_perm
from apps.core.permissions import OrganizationScopedQuerysetMixin
from apps.activity.models import ActivityLog
from apps.activity.serializers import ActivityLogSerializer
from apps.activity.utils import log_activity
from apps.users.serializers import UserSerializer
from .models import Property, Room, RoomImage, Booking, BookingSettings, Payment, Review
from .razorpay_client import get_client
from . import notifications, services

logger = logging.getLogger(__name__)
from .serializers import (
    PropertySerializer, RoomSerializer, RoomImageSerializer, BookingSerializer,
    BookingCreateSerializer, CustomerRegisterSerializer, BookingSettingsSerializer,
    PublicRoomSerializer, PublicPropertySerializer,
    ReviewCreateSerializer, PublicReviewSerializer, StaffReviewSerializer,
)

STAFF_ROLES = ('STP_ADMIN', 'STP_USER')


def _staff_can(user, perm):
    """STP staff of a Room Booking org whose role grants `perm` (apps.core.access)."""
    org = getattr(user, 'organization', None)
    return user.role in STAFF_ROLES and org is not None and org.org_type == 'ROOM_BOOKING' and has_perm(user, perm)


class CustomerRegisterView(APIView):
    """Self-service sign-up for one org's booking site — AllowAny, since
    the visitor has no account yet. Logs the new customer straight in
    (same token shape as LoginView) rather than making them sign up then
    separately log in."""
    permission_classes = [AllowAny]
    throttle_scope = 'signup'  # per-IP limit on new guest accounts

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user, context={'request': request}).data,
        }, status=status.HTTP_201_CREATED)


def _public_org_or_404(org_id):
    from django.http import Http404
    from apps.tenants.models import Organization
    org = Organization.objects.filter(pk=org_id, tenant_type='STP', org_type='ROOM_BOOKING', is_active=True).first()
    if not org:
        raise Http404('Not found or not accepting bookings.')
    return org


def _requested_stay(request):
    """(check_in, check_out) from the query string, or (None, None) if absent/invalid."""
    from django.utils.dateparse import parse_date
    try:
        check_in = parse_date(request.query_params.get('check_in') or '')
        check_out = parse_date(request.query_params.get('check_out') or '')
    except ValueError:
        return None, None
    if not check_in or not check_out or check_out <= check_in:
        return None, None
    return check_in, check_out


class PublicPropertyListView(APIView):
    """Anonymous: an org's active properties, for the booking site."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, org_id):
        org = _public_org_or_404(org_id)
        props = Property.objects.filter(organization=org, is_active=True).prefetch_related('rooms').order_by('name')
        return Response(PublicPropertySerializer(props, many=True).data)


class PublicRoomListView(APIView):
    """Anonymous: an org's active rooms, so visitors can browse before
    signing up. With ?check_in=&check_out= each room says whether it's free
    for that stay; ?guests= hides rooms that are too small; ?property=
    narrows to one building."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def _rooms(self, request, org):
        qs = (Room.objects.filter(organization=org, is_active=True)
              .filter(Q(property__isnull=True) | Q(property__is_active=True))
              .select_related('property').prefetch_related('images').order_by('price_per_night', 'name'))
        prop = request.query_params.get('property')
        if prop and prop.isdigit():
            qs = qs.filter(property_id=prop)
        guests = request.query_params.get('guests')
        if guests and guests.isdigit():
            qs = qs.filter(capacity__gte=int(guests))
        return qs

    def _context(self, request, rooms):
        check_in, check_out = _requested_stay(request)
        availability = {}
        if check_in:
            availability = {r.id: Booking.room_is_available(r, check_in, check_out) for r in rooms}
        return {'request': request, 'availability': availability}

    def get(self, request, org_id, room_id=None):
        org = _public_org_or_404(org_id)
        rooms = self._rooms(request, org)
        if room_id is not None:
            room = rooms.filter(pk=room_id).first()
            if not room:
                return Response({'error': 'Room not found.'}, status=status.HTTP_404_NOT_FOUND)
            return Response(PublicRoomSerializer(room, context=self._context(request, [room])).data)
        rooms = list(rooms)
        return Response(PublicRoomSerializer(rooms, many=True, context=self._context(request, rooms)).data)


def _initial_booking_state(rules):
    """How a new reservation starts, from the org's settings:

    - auto-confirm + online payments → pay now; confirmed once paid
      (an unpaid one releases the room after the payment window)
    - auto-confirm, no online payments → confirmed straight away, pay later
    - manual approval → waits for staff; once confirmed the guest can pay
      online (if set up) or at the property. Never expires on its own.
    """
    if rules.auto_confirm and get_client() is not None:
        return {'status': 'PENDING', 'payment_method': 'ONLINE'}
    if rules.auto_confirm:
        return {'status': 'CONFIRMED', 'payment_method': 'AT_PROPERTY'}
    return {'status': 'PENDING', 'payment_method': 'AT_PROPERTY'}


class GuestListView(APIView):
    """Settings-free "Guests" page for a property's staff: everyone who has
    booked *with this property*, with contact details from their bookings
    here and their stay counts here. Guest accounts themselves belong to the
    platform — staff can't see or edit them, nor a guest's stays elsewhere."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Max, Sum
        user = request.user
        org = user.organization
        if not _staff_can(user, 'guests.view'):
            return Response({'error': 'Your role doesn’t allow viewing guests.'}, status=status.HTTP_403_FORBIDDEN)
        bookings = Booking.objects.filter(organization=org)
        today = timezone.localdate()
        rows = (bookings.values('customer_id')
                .annotate(
                    bookings=Count('id'),
                    stays=Count('id', filter=Q(status='CHECKED_OUT')),
                    upcoming=Count('id', filter=Q(status__in=['PENDING', 'CONFIRMED', 'CHECKED_IN'], check_out__gte=today)),
                    spent=Sum('total_amount', filter=Q(status__in=['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'])),
                    last_check_in=Max('check_in'),
                    last_booking=Max('id'),
                ).order_by('-last_check_in'))
        # Contact details from the guest's most recent booking here.
        latest = {b.id: b for b in bookings.filter(id__in=[r['last_booking'] for r in rows]).select_related('customer')}
        q = (request.query_params.get('search') or '').strip().lower()
        out = []
        for r in rows:
            b = latest[r['last_booking']]
            entry = {
                'customer': r['customer_id'],
                'name': b.guest_name or b.customer.get_full_name(),
                'email': b.guest_email or b.customer.email,
                'phone': b.guest_phone or (b.customer.phone or ''),
                'bookings': r['bookings'], 'stays': r['stays'], 'upcoming': r['upcoming'],
                'total_spent': str(r['spent'] or 0), 'last_check_in': r['last_check_in'],
            }
            if q and q not in f"{entry['name']} {entry['email']} {entry['phone']}".lower():
                continue
            out.append(entry)
        return Response(out)


class CollectionReportView(APIView):
    """Daily collection: every payment received (and refunded) on one day,
    with totals by method. ?date=YYYY-MM-DD, property-local day; default today."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import datetime as dt
        from collections import defaultdict
        from decimal import Decimal
        from zoneinfo import ZoneInfo
        from django.utils.dateparse import parse_date
        if not _staff_can(request.user, 'payments.report'):
            return Response({'error': 'Your role doesn’t allow viewing collections.'}, status=status.HTTP_403_FORBIDDEN)
        tz = ZoneInfo(getattr(settings, 'PROPERTY_TIMEZONE', 'Asia/Kolkata'))
        day = parse_date(request.query_params.get('date') or '') or dt.datetime.now(tz).date()
        start = dt.datetime.combine(day, dt.time.min, tzinfo=tz)
        end = start + dt.timedelta(days=1)
        org = request.user.organization
        base = Payment.objects.filter(booking__organization=org).select_related('booking__room', 'collected_by')
        received = base.filter(status__in=['PAID', 'REFUNDED'], paid_at__gte=start, paid_at__lt=end).order_by('paid_at')
        refunded = base.filter(status='REFUNDED', updated_at__gte=start, updated_at__lt=end)

        totals = defaultdict(lambda: Decimal('0'))
        rows = []
        for p in received:
            totals[p.method] += p.amount
            b = p.booking
            rows.append({
                'id': p.id, 'time': p.paid_at.astimezone(tz).strftime('%H:%M'), 'booking_id': b.id,
                'guest': b.guest_name or b.customer.get_full_name(), 'room': b.room.name,
                'method': p.method, 'method_label': p.get_method_display(), 'amount': str(p.amount),
                'collected_by': p.collected_by.get_full_name() if p.collected_by else None,
                'note': p.note, 'refunded': p.status == 'REFUNDED',
            })
        refunds = sum((p.amount for p in refunded), Decimal('0'))
        gross = sum(totals.values(), Decimal('0'))
        return Response({
            'date': day.isoformat(),
            'totals': {m: str(totals.get(m, Decimal('0'))) for m, _ in Payment.METHOD_CHOICES},
            'gross': str(gross), 'refunds': str(refunds), 'net': str(gross - refunds),
            'count': len(rows), 'payments': rows,
        })


class StaffReviewListView(APIView):
    """Staff: this property's reviews, with private feedback (?rating=1..5, ?unreplied=1)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _staff_can(request.user, 'reviews.view'):
            return Response({'error': 'Your role doesn’t allow viewing reviews.'}, status=status.HTTP_403_FORBIDDEN)
        qs = Review.objects.filter(organization=request.user.organization).select_related('customer', 'booking__room', 'replied_by')
        rating = request.query_params.get('rating')
        if rating and rating.isdigit():
            qs = qs.filter(rating=int(rating))
        if request.query_params.get('unreplied') == '1':
            qs = qs.filter(reply='')
        from django.db.models import Avg, Count
        agg = Review.objects.filter(organization=request.user.organization).aggregate(avg=Avg('rating'), n=Count('id'))
        return Response({
            'average': round(agg['avg'], 1) if agg['avg'] else None, 'count': agg['n'],
            'reviews': StaffReviewSerializer(qs, many=True).data,
        })


class StaffReviewReplyView(APIView):
    """Staff post (or edit) the property's public reply to a review."""
    permission_classes = [IsAuthenticated]

    def post(self, request, review_id):
        if not _staff_can(request.user, 'reviews.reply'):
            return Response({'error': 'Your role doesn’t allow replying to reviews.'}, status=status.HTTP_403_FORBIDDEN)
        review = Review.objects.filter(pk=review_id, organization=request.user.organization).first()
        if not review:
            return Response({'error': 'Review not found.'}, status=status.HTTP_404_NOT_FOUND)
        reply = (request.data.get('reply') or '').strip()[:2000]
        review.reply = reply
        review.replied_by = request.user if reply else None
        review.replied_at = timezone.now() if reply else None
        review.save(update_fields=['reply', 'replied_by', 'replied_at', 'updated_at'])
        log_activity(request, 'UPDATE', obj=review, organization=review.organization, changes={'reply': ['', 'updated' if reply else 'removed']})
        return Response(StaffReviewSerializer(review).data)


class PublicReviewListView(APIView):
    """Anonymous: a property's most recent reviews (no private feedback)."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, org_id):
        org = _public_org_or_404(org_id)
        qs = Review.objects.filter(organization=org).select_related('customer', 'booking__room')[:20]
        return Response(PublicReviewSerializer(qs, many=True).data)


class BookingSettingsView(APIView):
    """Settings → Booking Site. Any staff of a Room Booking org can read
    it; only the org's admin can change it."""
    permission_classes = [IsAuthenticated]

    def _org(self, request):
        user = request.user
        org = user.organization
        if user.role not in STAFF_ROLES or not org or org.org_type != 'ROOM_BOOKING':
            return None
        return org

    def get(self, request):
        org = self._org(request)
        if not org or not (has_perm(request.user, 'bookings.view') or has_perm(request.user, 'settings.manage')):
            return Response({'error': 'Your role doesn’t allow viewing booking settings.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(BookingSettingsSerializer(BookingSettings.for_org(org)).data)

    def patch(self, request):
        org = self._org(request)
        if not org or not has_perm(request.user, 'settings.manage'):
            return Response({'error': 'Your role doesn’t allow changing booking settings.'}, status=status.HTTP_403_FORBIDDEN)
        obj = BookingSettings.for_org(org)
        serializer = BookingSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        before = {f: str(getattr(obj, f)) for f in serializer.validated_data}
        serializer.save()
        changes = {f: [before[f], str(getattr(obj, f))] for f in before if before[f] != str(getattr(obj, f))}
        if changes:
            log_activity(request, 'UPDATE', obj=obj, organization=org, changes=changes)
        return Response(serializer.data)

    put = patch


_OUTCOME_MESSAGES = {
    services.REFUNDED: 'Payment received, but this room was no longer available, so the full amount has been refunded.',
    services.NEEDS_MANUAL_REFUND: 'Payment received, but this room was no longer available. The organization will refund you shortly.',
}


def _notify_payment_outcome(booking, old_status):
    """Email the guest when a payment confirmed or (refunded →) cancelled their booking."""
    if booking.status != old_status and booking.status in ('CONFIRMED', 'CANCELLED'):
        notifications.notify(booking, 'confirmed' if booking.status == 'CONFIRMED' else 'cancelled')


def _payment_outcome_response(request, booking, old_status, outcome, serializer_context):
    if booking.status != old_status:
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': [old_status, booking.status]})
    _notify_payment_outcome(booking, old_status)
    if outcome in _OUTCOME_MESSAGES:
        return Response({'error': _OUTCOME_MESSAGES[outcome], 'outcome': outcome,
                         'booking': BookingSerializer(booking, context=serializer_context).data},
                        status=status.HTTP_409_CONFLICT)
    return Response(BookingSerializer(booking, context=serializer_context).data)


class RazorpayWebhookView(APIView):
    """Server-to-server payment notification from Razorpay. This is what
    confirms a booking when the customer pays but closes the tab before the
    browser's verify_payment call runs. Configure it in the Razorpay
    dashboard (Settings -> Webhooks) for the `payment.captured` and
    `order.paid` events, with RAZORPAY_WEBHOOK_SECRET as the secret."""
    permission_classes = [AllowAny]
    authentication_classes = []  # authenticated by the HMAC signature instead

    def post(self, request):
        secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', '')
        client = get_client()
        if not secret or client is None:
            return Response({'error': 'Webhook not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        body = request.body.decode('utf-8')
        try:
            client.utility.verify_webhook_signature(body, request.headers.get('X-Razorpay-Signature', ''), secret)
        except SignatureVerificationError:
            return Response({'error': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

        event = json.loads(body)
        if event.get('event') not in ('payment.captured', 'order.paid'):
            return Response({'status': 'ignored'})
        entity = (event.get('payload', {}).get('payment') or {}).get('entity') or {}
        order_id, payment_id = entity.get('order_id'), entity.get('id')
        payment = Payment.objects.filter(razorpay_order_id=order_id).select_related('booking').first() if order_id else None
        if not payment:
            # Not one of ours -- acknowledge so Razorpay doesn't keep retrying.
            return Response({'status': 'unknown order'})

        old_status = payment.booking.status
        booking, outcome = services.confirm_payment(payment, payment_id)
        if booking.status != old_status:
            log_activity(request, 'UPDATE', obj=booking, organization=booking.organization,
                         changes={'status': [old_status, booking.status]})
        _notify_payment_outcome(booking, old_status)
        return Response({'status': outcome})


class RoomBookingStaffMixin:
    """Shared by every viewset in this file that staff manage (Property,
    Room) — staff can only manage records for their own org, and only if
    that org is actually a ROOM_BOOKING org (defense in depth — the STP
    portal's own nav/routes already gate on this, but the API must not
    rely on the frontend alone)."""

    def _staff_org_or_403(self):
        user = self.request.user
        return user.organization if _staff_can(user, 'rooms.manage') else None


class PropertyViewSet(RoomBookingStaffMixin, OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated]
    organization_lookup = 'organization'

    def get_queryset(self):
        user = self.request.user
        qs = Property.objects.select_related('organization').prefetch_related('rooms')
        if user.role in STAFF_ROLES:
            return self.get_organization_scoped_queryset(qs) if has_perm(user, 'rooms.view') else qs.none()
        if user.role == 'CUSTOMER':
            return self.get_organization_scoped_queryset(qs).filter(is_active=True)
        return qs.none()

    def create(self, request, *args, **kwargs):
        org = self._staff_org_or_403()
        if not org:
            return Response({'error': 'Only Room Booking STP staff can manage properties.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data, context={**self.get_serializer_context(), 'organization': org})
        serializer.is_valid(raise_exception=True)
        prop = serializer.save(organization=org)
        log_activity(request, 'CREATE', obj=prop, organization=org)
        return Response(self.get_serializer(prop).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        if not self._staff_org_or_403():
            raise PermissionDenied('Only Room Booking STP staff can manage properties.')
        prop = serializer.save()
        log_activity(self.request, 'UPDATE', obj=prop, organization=prop.organization)

    def perform_destroy(self, instance):
        if not self._staff_org_or_403():
            raise PermissionDenied('Only Room Booking STP staff can manage properties.')
        log_activity(self.request, 'DELETE', obj=instance, organization=instance.organization)
        instance.delete()


class RoomViewSet(RoomBookingStaffMixin, OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    organization_lookup = 'organization'

    def get_queryset(self):
        user = self.request.user
        qs = Room.objects.select_related('organization', 'property').prefetch_related('images')
        if user.role in STAFF_ROLES:
            if not has_perm(user, 'rooms.view'):
                return qs.none()
            qs = self.get_organization_scoped_queryset(qs)
        elif user.role == 'CUSTOMER':
            qs = self.get_organization_scoped_queryset(qs).filter(is_active=True)
        else:
            return qs.none()
        # Powers the customer's "rooms in this building" page — staff can
        # use it too (e.g. a Rooms-page building filter).
        property_id = self.request.query_params.get('property')
        if property_id:
            qs = qs.filter(property_id=property_id)
        return qs

    def create(self, request, *args, **kwargs):
        org = self._staff_org_or_403()
        if not org:
            return Response({'error': 'Only Room Booking STP staff can manage rooms.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data, context={**self.get_serializer_context(), 'organization': org})
        serializer.is_valid(raise_exception=True)
        room = serializer.save(organization=org)
        log_activity(request, 'CREATE', obj=room, organization=org)
        return Response(self.get_serializer(room).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        # get_queryset() already scopes a CUSTOMER to their own org's
        # active rooms, so without this check they could PATCH a room they
        # can merely *view* — DRF's UpdateModelMixin doesn't gate HTTP verbs
        # by role on its own, only get_queryset/get_object do, and that's
        # visibility scoping, not a write permission.
        if not self._staff_org_or_403():
            raise PermissionDenied('Only Room Booking STP staff can manage rooms.')
        room = serializer.save()
        log_activity(self.request, 'UPDATE', obj=room, organization=room.organization)

    def perform_destroy(self, instance):
        if not self._staff_org_or_403():
            raise PermissionDenied('Only Room Booking STP staff can manage rooms.')
        log_activity(self.request, 'DELETE', obj=instance, organization=instance.organization)
        instance.delete()

    @action(detail=True, methods=['post'], url_path='images')
    def upload_image(self, request, pk=None):
        room = self.get_object()
        if not self._staff_org_or_403():
            return Response({'error': 'Only Room Booking STP staff can manage rooms.'}, status=status.HTTP_403_FORBIDDEN)
        if 'file' not in request.FILES:
            return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)
        img = RoomImage.objects.create(
            room=room, image=request.FILES['file'],
            is_primary=request.data.get('is_primary') in ('true', 'True', True),
        )
        return Response(RoomImageSerializer(img).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'images/(?P<image_id>[^/.]+)')
    def delete_image(self, request, pk=None, image_id=None):
        room = self.get_object()
        if not self._staff_org_or_403():
            return Response({'error': 'Only Room Booking STP staff can manage rooms.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            img = RoomImage.objects.get(id=image_id, room=room)
        except RoomImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)
        img.image.delete(save=False)
        img.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookingViewSet(OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    organization_lookup = 'organization'
    http_method_names = ['get', 'post', 'head', 'options']  # no PUT/PATCH/DELETE — status changes go through the actions below

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'request': self.request}

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.select_related('room', 'customer', 'organization', 'organization__booking_settings', 'property', 'review').prefetch_related('payments', 'room__images')
        if user.role in STAFF_ROLES:
            if not has_perm(user, 'bookings.view'):
                return qs.none()
            qs = self.get_organization_scoped_queryset(qs)
            customer = self.request.query_params.get('customer')
            return qs.filter(customer_id=customer) if customer and customer.isdigit() else qs
        if user.role == 'CUSTOMER':
            return qs.filter(customer=user)
        return qs.none()

    def list(self, request, *args, **kwargs):
        # Keep statuses honest for whoever is looking (the periodic task
        # does this too; availability never depends on either).
        services.expire_stale_pending(self.get_queryset())
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if request.user.role != 'CUSTOMER':
            return Response({'error': 'Only customers can create a reservation.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = BookingCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        room = serializer.validated_data['room']
        rules = BookingSettings.for_org(room.organization)
        if not rules.accepting_bookings:
            return Response({'error': f'{room.organization.name} is not accepting new bookings right now.'}, status=status.HTTP_400_BAD_REQUEST)
        check_in, check_out = serializer.validated_data['check_in'], serializer.validated_data['check_out']
        nights = (check_out - check_in).days
        with transaction.atomic():
            # The serializer's availability check is a fast pre-check; this
            # re-check happens while holding a lock on the room row, so two
            # customers booking the same room at the same moment are
            # serialized and only the first one gets it.
            Room.objects.select_for_update().get(pk=room.pk)
            blocking = list(Booking.blocking_bookings(room, check_in, check_out))
            mine = [b for b in blocking if b.customer_id == request.user.id]
            if blocking and len(mine) == len(blocking):
                same = next((b for b in mine if b.status in ('PENDING', 'CONFIRMED') and b.check_in == check_in and b.check_out == check_out), None)
                if same:
                    # A retry (e.g. they closed the payment window): hand back
                    # the reservation they already hold instead of an error.
                    return Response(BookingSerializer(same, context=self.get_serializer_context()).data, status=status.HTTP_200_OK)
                return Response({'room': ['You already have a reservation for this room on some of these dates. See My Bookings.']},
                                status=status.HTTP_400_BAD_REQUEST)
            if blocking:
                return Response({'room': ['This room is already booked for the selected dates.']}, status=status.HTTP_400_BAD_REQUEST)
            booking = serializer.save(
                organization=room.organization,
                property=room.property,
                customer=request.user,
                total_amount=room.price_per_night * nights,
                guest_name=request.user.get_full_name(),
                guest_email=request.user.email,
                guest_phone=request.user.phone or '',
                **_initial_booking_state(rules),
            )
        log_activity(request, 'CREATE', obj=booking, organization=room.organization)
        if booking.status == 'CONFIRMED':
            notifications.notify(booking, 'confirmed')
        elif booking.payment_method == 'AT_PROPERTY':
            notifications.notify(booking, 'requested')  # waiting for the property to confirm
        # ONLINE + PENDING: the confirmation goes out once payment succeeds
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def _staff_for(self, booking, perm='bookings.manage'):
        user = self.request.user
        return user.organization_id == booking.organization_id and _staff_can(user, perm)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        """
        Full timeline for this one booking — every ActivityLog row written
        against it by log_activity() (made, paid/confirmed, checked in,
        checked out, cancelled, refunded...), oldest first. get_object()
        already scopes visibility the same as the rest of this viewset
        (customer sees only their own booking, staff only their org's), so
        unlike the admin-only ActivityLogViewSet, the booking's own
        customer can read this too — it's their history, not an audit feed.
        """
        booking = self.get_object()
        logs = ActivityLog.objects.filter(model_name='Booking', object_id=str(booking.id)).order_by('created_at')
        data = ActivityLogSerializer(logs, many=True).data
        if request.user.role == 'CUSTOMER':
            # Guests see what happened and when, not who on the staff did it
            # or anyone's IP address.
            for row in data:
                mine = row.get('actor_username') == request.user.username
                row['actor_username'] = 'You' if mine else (booking.organization.name if row.get('actor_username') else None)
                row['actor_role'] = None
                row['ip_address'] = None
        return Response(data)

    @action(detail=True, methods=['post'], url_path='create_order')
    def create_order(self, request, pk=None):
        booking = self.get_object()
        if request.user.role != 'CUSTOMER' or booking.customer_id != request.user.id:
            return Response({'error': 'Not your reservation.'}, status=status.HTTP_403_FORBIDDEN)
        if services.is_stale_pending(booking):
            services.expire_stale_pending(Booking.objects.filter(pk=booking.pk))
            return Response({'error': 'This reservation expired before payment. Please book again.'}, status=status.HTTP_400_BAD_REQUEST)
        if booking.status == 'PENDING' and booking.payment_method == 'AT_PROPERTY':
            return Response({'error': 'The property hasn’t confirmed this booking yet. You can pay once it’s confirmed.'}, status=status.HTTP_400_BAD_REQUEST)
        if booking.status not in ('PENDING', 'CONFIRMED'):
            return Response({'error': f'This reservation is {booking.get_status_display().lower()}.'}, status=status.HTTP_400_BAD_REQUEST)
        due = services.balance_due(booking)
        if due <= 0:
            return Response({'error': 'This reservation is already paid.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_client()
        if client is None:
            return Response({'error': 'Payment gateway is not configured yet. Contact the organization.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        amount_paise = int(due * 100)
        try:
            order = client.order.create({'amount': amount_paise, 'currency': 'INR', 'receipt': f'booking-{booking.id}'})
        except Exception:
            logger.exception('Razorpay order creation failed for booking %s', booking.pk)
            return Response({'error': 'Could not start the payment. Please try again in a minute.'}, status=status.HTTP_502_BAD_GATEWAY)
        Payment.objects.create(booking=booking, razorpay_order_id=order['id'], amount=due, status='CREATED', method='ONLINE')
        return Response({
            'order_id': order['id'], 'amount': amount_paise, 'currency': 'INR',
            'key_id': client.auth[0],
        })

    @action(detail=True, methods=['post'], url_path='verify_payment')
    def verify_payment(self, request, pk=None):
        booking = self.get_object()
        if request.user.role != 'CUSTOMER' or booking.customer_id != request.user.id:
            return Response({'error': 'Not your reservation.'}, status=status.HTTP_403_FORBIDDEN)

        order_id = request.data.get('razorpay_order_id')
        payment_id = request.data.get('razorpay_payment_id')
        signature = request.data.get('razorpay_signature')
        # Any status: the webhook may already have marked it PAID, in which
        # case this callback is a harmless repeat.
        payment = Payment.objects.filter(booking=booking, razorpay_order_id=order_id).order_by('-created_at').first()
        if not payment:
            return Response({'error': 'No matching payment for this reservation.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_client()
        if client is None:
            return Response({'error': 'Payment gateway is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            client.utility.verify_payment_signature({
                'razorpay_order_id': order_id, 'razorpay_payment_id': payment_id, 'razorpay_signature': signature,
            })
        except SignatureVerificationError:
            # Don't touch the stored payment: a forged/garbled callback must
            # not be able to mark a genuine payment FAILED.
            return Response({'error': 'Payment verification failed.'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = booking.status
        booking, outcome = services.confirm_payment(payment, payment_id, signature)
        return _payment_outcome_response(request, booking, old_status, outcome, self.get_serializer_context())

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        booking = self.get_object()
        is_owner = request.user.role == 'CUSTOMER' and booking.customer_id == request.user.id
        if not (is_owner or self._staff_for(booking)):
            return Response({'error': 'Not your reservation.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status not in ('PENDING', 'CONFIRMED'):
            return Response({'error': f'Cannot cancel a {booking.get_status_display().lower()} reservation.'}, status=status.HTTP_400_BAD_REQUEST)
        staff = self._staff_for(booking)
        if not staff and not services.guest_can_cancel(booking):
            phone = booking.organization.contact_phone
            return Response({'error': 'The free cancellation window for this booking has passed. '
                                      f'Please contact {booking.organization.name}{f" on {phone}" if phone else ""} to cancel.'},
                            status=status.HTTP_400_BAD_REQUEST)
        # A guest cancelling in time gets their online payment back.
        refunded = False
        paid = booking.payments.filter(status='PAID').order_by('-created_at').first()
        if paid and not staff:
            try:
                services.refund_payment(paid)
                refunded = True
            except services.RefundFailed:
                return Response({'error': 'We couldn’t process your refund right now, so the booking is still active. '
                                          'Please try again in a few minutes or contact the property.'},
                                status=status.HTTP_502_BAD_GATEWAY)
        old_status = booking.status
        booking.status = 'CANCELLED'
        booking.cancel_reason = 'STAFF' if staff and not is_owner else ('REFUNDED' if refunded else 'CUSTOMER')
        booking.cancelled_at = timezone.now()
        booking.save(update_fields=['status', 'cancel_reason', 'cancelled_at', 'updated_at'])
        notifications.notify(booking, 'cancelled')
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': [old_status, 'CANCELLED']})
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)

    def _staff_transition(self, request, pk, from_statuses, to_status):
        booking = self.get_object()
        if not self._staff_for(booking):
            return None, Response({'error': 'Staff only.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status not in from_statuses:
            return None, Response({'error': f'Cannot move a {booking.get_status_display().lower()} reservation to {to_status}.'}, status=status.HTTP_400_BAD_REQUEST)
        old_status = booking.status
        booking.status = to_status
        booking.save(update_fields=['status', 'updated_at'])
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': [old_status, to_status]})
        if to_status in ('CONFIRMED', 'CHECKED_OUT'):
            notifications.notify(booking, 'confirmed' if to_status == 'CONFIRMED' else 'checked_out')
        return booking, None

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        booking, err = self._staff_transition(request, pk, ['PENDING'], 'CONFIRMED')
        if err:
            return err
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='check_in')
    def check_in(self, request, pk=None):
        booking, err = self._staff_transition(request, pk, ['CONFIRMED'], 'CHECKED_IN')
        if err:
            return err
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='check_out')
    def check_out(self, request, pk=None):
        booking, err = self._staff_transition(request, pk, ['CHECKED_IN'], 'CHECKED_OUT')
        if err:
            return err
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get'], url_path='voucher')
    def voucher(self, request, pk=None):
        """Booking confirmation PDF — the guest's own booking, or any booking
        staff can see (get_object() applies the same visibility rules)."""
        from django.http import HttpResponse
        from .voucher import booking_reference, build_voucher_pdf
        booking = self.get_object()
        response = HttpResponse(build_voucher_pdf(booking), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="booking-{booking_reference(booking)}.pdf"'
        return response

    @action(detail=True, methods=['post'], url_path='record_payment')
    def record_payment(self, request, pk=None):
        """Staff record money taken at the desk: {method: CASH|UPI|CARD|OTHER, amount?, note?}.
        Amount defaults to whatever is still owed; partial payments are fine."""
        booking = self.get_object()
        if not self._staff_for(booking, 'payments.collect'):
            return Response({'error': 'Your role doesn’t allow recording payments.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            payment = services.record_desk_payment(booking, request.data.get('amount'), request.data.get('method'),
                                                   request.user, request.data.get('note', ''))
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization,
                     changes={'payment': ['', f'{payment.get_method_display()} ₹{payment.amount}']})
        return Response(BookingSerializer(self._fresh(booking), context=self.get_serializer_context()).data)

    def _fresh(self, booking):
        """Reload with payments/review re-fetched (get_object()'s prefetch is stale after a change)."""
        return self.get_queryset().get(pk=booking.pk)

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        """The guest rates a completed stay — once."""
        booking = self.get_object()
        if request.user.role != 'CUSTOMER' or booking.customer_id != request.user.id:
            return Response({'error': 'Only the guest who stayed can review it.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'CHECKED_OUT':
            return Response({'error': 'You can review a stay after you check out.'}, status=status.HTTP_400_BAD_REQUEST)
        if Review.objects.filter(booking=booking).exists():
            return Response({'error': 'You’ve already reviewed this stay.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        Review.objects.create(booking=booking, organization=booking.organization, customer=request.user,
                              **serializer.validated_data)
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='refund')
    def refund(self, request, pk=None):
        booking = self.get_object()
        if not self._staff_for(booking, 'payments.refund'):
            return Response({'error': 'Staff only.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status not in ('CONFIRMED', 'CANCELLED'):
            return Response({'error': f'Cannot refund a {booking.get_status_display().lower()} reservation.'}, status=status.HTTP_400_BAD_REQUEST)
        payment = booking.payments.filter(status='PAID').order_by('-created_at').first()
        if not payment:
            return Response({'error': 'No paid payment to refund.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            services.refund_payment(payment)
        except services.RefundFailed as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        old_status = booking.status
        booking.status = 'CANCELLED'
        booking.cancel_reason = 'REFUNDED'
        booking.cancelled_at = booking.cancelled_at or timezone.now()
        booking.save(update_fields=['status', 'cancel_reason', 'cancelled_at', 'updated_at'])
        notifications.notify(booking, 'cancelled')
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': [old_status, 'CANCELLED'], 'payment': ['PAID', 'REFUNDED']})
        return Response(BookingSerializer(self._fresh(booking), context=self.get_serializer_context()).data)
