"""Tenant isolation: staff of one hotel must never see or change another's data.

Two organizations with the same kinds of records; every staff endpoint is
called by hotel A's admin (full permissions) against hotel B's records.
"""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, Payment, Property, Review, Room
from apps.bookings.staff_views import (
    BookingsExportView, CollectionsExportView, DashboardView, RoomCalendarView, StaffNotificationsView, WalkInBookingView,
)
from apps.bookings.views import (
    BookingViewSet, CollectionReportView, GuestListView, PropertyViewSet, RoomViewSet, StaffReviewListView, StaffReviewReplyView,
)
from apps.tenants.models import Organization
from apps.users.models import User
from apps.users.views import UserViewSet


def _org(schema, name):
    o = Organization(schema_name=schema, name=name, tenant_type='STP', org_type='ROOM_BOOKING')
    o.auto_create_schema = False
    o.save()
    return o


def _hotel(schema, name, guest_email):
    org = _org(schema, name)
    admin = User.objects.create_user(username=f'{schema}-admin', email=f'{schema}@staff.x', password='x' * 12,
                                     role='STP_ADMIN', organization=org)
    guest = User.objects.create_user(username=guest_email, email=guest_email, password='x' * 12, role='CUSTOMER',
                                     first_name=f'{name}Guest')
    prop = Property.objects.create(organization=org, name=f'{name} Main')
    room = Room.objects.create(organization=org, property=prop, name=f'{name}-101', price_per_night=Decimal('1000'))
    today = timezone.localdate()
    booking = Booking.objects.create(organization=org, property=prop, room=room, customer=guest, guest_name=f'{name} Guest',
                                     check_in=today, check_out=today + timedelta(days=1), status='CONFIRMED',
                                     payment_method='AT_PROPERTY', total_amount=Decimal('1000'),
                                     cancel_request_status='PENDING', cancel_request_reason='Plans changed',
                                     cancel_requested_at=timezone.now())
    Payment.objects.create(booking=booking, razorpay_order_id='', amount=Decimal('400'), status='PAID', method='CASH',
                           paid_at=timezone.now())
    review = Review.objects.create(booking=booking, organization=org, customer=guest, rating=4, comment=f'{name} review')
    return {'org': org, 'admin': admin, 'guest': guest, 'prop': prop, 'room': room, 'booking': booking, 'review': review}


@override_settings(BOOKING_EMAILS_ASYNC=False)
class TenantIsolationTests(TestCase):
    def setUp(self):
        self.a = _hotel('ta', 'Alpha', 'ga@x.com')
        self.b = _hotel('tb', 'Bravo', 'gb@x.com')
        self.user = self.a['admin']

    def req(self, view, method='get', data=None, **kwargs):
        factory = APIRequestFactory()
        request = getattr(factory, method)('/', data or {}, format='json') if method != 'get' else factory.get('/', data or {})
        force_authenticate(request, user=self.user)
        return view(request, **kwargs)

    def assertNoBravo(self, payload):
        text = str(payload)
        for marker in ('Bravo', 'gb@x.com', 'tb@staff.x'):
            self.assertNotIn(marker, text, f'leaked {marker!r}')

    # ---- lists only contain my own hotel ------------------------------------
    def test_lists_never_include_other_hotels(self):
        for view in (BookingViewSet.as_view({'get': 'list'}), RoomViewSet.as_view({'get': 'list'}),
                     PropertyViewSet.as_view({'get': 'list'}), UserViewSet.as_view({'get': 'list'}),
                     GuestListView.as_view(), CollectionReportView.as_view(), StaffReviewListView.as_view(),
                     DashboardView.as_view(), StaffNotificationsView.as_view()):
            r = self.req(view)
            self.assertEqual(r.status_code, 200, view)
            self.assertNoBravo(r.data)
        cal = self.req(RoomCalendarView.as_view()).data
        self.assertEqual([r['name'] for r in cal['rooms']], ['Alpha-101'])
        for view in (BookingsExportView.as_view(), CollectionsExportView.as_view()):
            body = self.req(view).content.decode('utf-8-sig')
            self.assertIn('Alpha', body)
            self.assertNotIn('Bravo', body)

    # ---- direct access to another hotel's records ----------------------------
    def test_cannot_read_or_change_other_hotels_records(self):
        b = self.b
        self.assertEqual(self.req(BookingViewSet.as_view({'get': 'retrieve'}), pk=b['booking'].id).status_code, 404)
        self.assertEqual(self.req(RoomViewSet.as_view({'get': 'retrieve'}), pk=b['room'].id).status_code, 404)
        self.assertEqual(self.req(PropertyViewSet.as_view({'get': 'retrieve'}), pk=b['prop'].id).status_code, 404)
        self.assertEqual(self.req(UserViewSet.as_view({'get': 'retrieve'}), pk=b['admin'].id).status_code, 404)
        self.assertIn(self.req(RoomViewSet.as_view({'patch': 'partial_update'}), 'patch', {'price_per_night': '1'}, pk=b['room'].id).status_code, (403, 404))
        self.assertIn(self.req(RoomViewSet.as_view({'delete': 'destroy'}), 'delete', pk=b['room'].id).status_code, (403, 404))
        for action, data in (('confirm', {}), ('check_in', {}), ('check_out', {}), ('cancel', {}), ('refund', {}),
                             ('record_payment', {'method': 'CASH'}), ('cancel_request_decision', {'decision': 'approve'})):
            r = self.req(BookingViewSet.as_view({'post': action}), 'post', data, pk=b['booking'].id)
            self.assertIn(r.status_code, (403, 404), action)
        self.assertIn(self.req(StaffReviewReplyView.as_view(), 'post', {'reply': 'hi'}, review_id=b['review'].id).status_code, (403, 404))
        # Booking another hotel's room at the desk.
        today = timezone.localdate()
        r = self.req(WalkInBookingView.as_view(), 'post', {
            'room': b['room'].id, 'check_in': str(today + timedelta(days=3)), 'check_out': str(today + timedelta(days=4)),
            'guest_name': 'Sneaky', 'guest_phone': '9999999999'})
        self.assertEqual((r.status_code, 'room' in r.data), (400, True))

        b['booking'].refresh_from_db()
        b['room'].refresh_from_db()
        self.assertEqual((b['booking'].status, b['booking'].cancel_request_status, b['room'].price_per_night),
                         ('CONFIRMED', 'PENDING', Decimal('1000.00')))
        self.assertEqual(Payment.objects.filter(booking=b['booking']).count(), 1)
