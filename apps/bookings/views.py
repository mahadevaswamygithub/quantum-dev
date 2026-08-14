from django.utils import timezone
from razorpay.errors import SignatureVerificationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import OrganizationScopedQuerysetMixin
from apps.activity.utils import log_activity
from apps.users.serializers import UserSerializer
from .models import Property, Room, RoomImage, Booking, Payment
from .razorpay_client import get_client
from .serializers import (
    PropertySerializer, RoomSerializer, RoomImageSerializer, BookingSerializer,
    BookingCreateSerializer, CustomerRegisterSerializer,
)

STAFF_ROLES = ('STP_ADMIN', 'STP_USER')


class CustomerRegisterView(APIView):
    """Self-service sign-up for one org's booking site — AllowAny, since
    the visitor has no account yet. Logs the new customer straight in
    (same token shape as LoginView) rather than making them sign up then
    separately log in."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CustomerRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        log_activity(request, 'LOGIN', actor=user, organization=user.organization, object_repr='Registered and signed in')
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)


class RoomBookingStaffMixin:
    """Shared by every viewset in this file that staff manage (Property,
    Room) — staff can only manage records for their own org, and only if
    that org is actually a ROOM_BOOKING org (defense in depth — the STP
    portal's own nav/routes already gate on this, but the API must not
    rely on the frontend alone)."""

    def _staff_org_or_403(self):
        user = self.request.user
        if user.role not in STAFF_ROLES:
            return None
        org = user.organization
        if not org or org.org_type != 'ROOM_BOOKING':
            return None
        return org


class PropertyViewSet(RoomBookingStaffMixin, OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated]
    organization_lookup = 'organization'

    def get_queryset(self):
        user = self.request.user
        qs = Property.objects.select_related('organization').prefetch_related('rooms')
        if user.role in STAFF_ROLES:
            return self.get_organization_scoped_queryset(qs)
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
        qs = Booking.objects.select_related('room', 'customer', 'organization').prefetch_related('payments', 'room__images')
        if user.role in STAFF_ROLES:
            return self.get_organization_scoped_queryset(qs)
        if user.role == 'CUSTOMER':
            return qs.filter(customer=user)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != 'CUSTOMER':
            return Response({'error': 'Only customers can create a reservation.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        room = serializer.validated_data['room']
        nights = (serializer.validated_data['check_out'] - serializer.validated_data['check_in']).days
        booking = serializer.save(
            organization=room.organization,
            property=room.property,
            customer=request.user,
            status='PENDING',
            total_amount=room.price_per_night * nights,
        )
        log_activity(request, 'CREATE', obj=booking, organization=room.organization)
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def _staff_for(self, booking):
        user = self.request.user
        return user.role in STAFF_ROLES and user.organization_id == booking.organization_id

    @action(detail=True, methods=['post'], url_path='create_order')
    def create_order(self, request, pk=None):
        booking = self.get_object()
        if request.user.role != 'CUSTOMER' or booking.customer_id != request.user.id:
            return Response({'error': 'Not your reservation.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'PENDING':
            return Response({'error': f'This reservation is already {booking.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_client()
        if client is None:
            return Response({'error': 'Payment gateway is not configured yet. Contact the organization.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        amount_paise = int(booking.total_amount * 100)
        order = client.order.create({'amount': amount_paise, 'currency': 'INR', 'receipt': f'booking-{booking.id}'})
        Payment.objects.create(booking=booking, razorpay_order_id=order['id'], amount=booking.total_amount, status='CREATED')
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
        payment = Payment.objects.filter(booking=booking, razorpay_order_id=order_id, status='CREATED').order_by('-created_at').first()
        if not payment:
            return Response({'error': 'No matching pending payment for this reservation.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_client()
        if client is None:
            return Response({'error': 'Payment gateway is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        try:
            client.utility.verify_payment_signature({
                'razorpay_order_id': order_id, 'razorpay_payment_id': payment_id, 'razorpay_signature': signature,
            })
        except SignatureVerificationError:
            payment.status = 'FAILED'
            payment.razorpay_payment_id = payment_id or ''
            payment.save(update_fields=['status', 'razorpay_payment_id'])
            return Response({'error': 'Payment verification failed.'}, status=status.HTTP_400_BAD_REQUEST)

        payment.status = 'PAID'
        payment.razorpay_payment_id = payment_id
        payment.razorpay_signature = signature
        payment.save()
        booking.status = 'CONFIRMED'
        booking.save(update_fields=['status', 'updated_at'])
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': ['PENDING', 'CONFIRMED']})
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        booking = self.get_object()
        is_owner = request.user.role == 'CUSTOMER' and booking.customer_id == request.user.id
        if not (is_owner or self._staff_for(booking)):
            return Response({'error': 'Not your reservation.'}, status=status.HTTP_403_FORBIDDEN)
        if booking.status not in ('PENDING', 'CONFIRMED'):
            return Response({'error': f'Cannot cancel a {booking.get_status_display().lower()} reservation.'}, status=status.HTTP_400_BAD_REQUEST)
        old_status = booking.status
        booking.status = 'CANCELLED'
        booking.cancelled_at = timezone.now()
        booking.save(update_fields=['status', 'cancelled_at', 'updated_at'])
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

    @action(detail=True, methods=['post'], url_path='refund')
    def refund(self, request, pk=None):
        booking = self.get_object()
        if not self._staff_for(booking):
            return Response({'error': 'Staff only.'}, status=status.HTTP_403_FORBIDDEN)
        payment = booking.payments.filter(status='PAID').order_by('-created_at').first()
        if not payment:
            return Response({'error': 'No paid payment to refund.'}, status=status.HTTP_400_BAD_REQUEST)

        client = get_client()
        if client is None:
            return Response({'error': 'Payment gateway is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        client.payment.refund(payment.razorpay_payment_id, {'amount': int(payment.amount * 100)})
        payment.status = 'REFUNDED'
        payment.save(update_fields=['status', 'updated_at'])
        old_status = booking.status
        booking.status = 'CANCELLED'
        booking.cancelled_at = timezone.now()
        booking.save(update_fields=['status', 'cancelled_at', 'updated_at'])
        log_activity(request, 'UPDATE', obj=booking, organization=booking.organization, changes={'status': [old_status, 'CANCELLED'], 'payment': ['PAID', 'REFUNDED']})
        return Response(BookingSerializer(booking, context=self.get_serializer_context()).data)
