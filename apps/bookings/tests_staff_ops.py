"""Front-office: dashboard, room calendar, walk-ins, staff alerts, exports, MSP overview."""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, Payment, Property, Room
from apps.bookings.staff_views import (
    BookingsExportView, CollectionsExportView, DashboardView, RoomCalendarView, StaffNotificationsView, WalkInBookingView, _today,
)
from apps.tenants.models import Organization
from apps.tenants.views import OrganizationViewSet
from apps.users.models import OrgRole, User


def call(view, user, method='get', data=None, **query):
    factory = APIRequestFactory()
    request = factory.post('/', data or {}, format='json') if method == 'post' else factory.get('/', query)
    force_authenticate(request, user=user)
    return view(request)


@override_settings(BOOKING_EMAILS_ASYNC=False)
class StaffOpsTests(TestCase):
    def setUp(self):
        self.msp = Organization(schema_name='m', name='MSP', tenant_type='MSP')
        self.msp.auto_create_schema = False
        self.msp.save()
        self.org = Organization(schema_name='h', name='Hotel', tenant_type='STP', org_type='ROOM_BOOKING', parent_organization=self.msp)
        self.org.auto_create_schema = False
        self.org.save()
        role = lambda n: OrgRole.objects.get(organization=self.org, name=n)  # noqa: E731
        mk = lambda u, r, **kw: User.objects.create_user(username=u, email=f'{u}@x.com', password='x' * 12, role=r, **kw)  # noqa: E731
        self.admin = mk('admin', 'STP_ADMIN', organization=self.org)
        self.desk = mk('desk', 'STP_USER', organization=self.org, access_role=role('Front desk'))
        self.viewer = mk('view', 'STP_USER', organization=self.org, access_role=role('Viewer'))
        self.guest = mk('guest', 'CUSTOMER', first_name='Asha')
        self.msp_admin = mk('mspa', 'MSP_ADMIN', organization=self.msp)
        prop = Property.objects.create(organization=self.org, name='Main')
        self.r1 = Room.objects.create(organization=self.org, property=prop, name='101', price_per_night=Decimal('1000'), capacity=2)
        self.r2 = Room.objects.create(organization=self.org, property=prop, name='102', price_per_night=Decimal('1500'), capacity=3)
        self.today = _today()
        self.b = Booking.objects.create(organization=self.org, property=prop, room=self.r1, customer=self.guest, guest_name='Asha',
                                        check_in=self.today, check_out=self.today + timedelta(days=2), status='CONFIRMED',
                                        payment_method='AT_PROPERTY', total_amount=Decimal('2000'))
        Payment.objects.create(booking=self.b, razorpay_order_id='', amount=Decimal('500'), status='PAID', method='CASH',
                               paid_at=timezone.now())

    def test_dashboard(self):
        self.assertEqual(call(DashboardView.as_view(), self.guest).status_code, 403)
        d = call(DashboardView.as_view(), self.viewer).data
        self.assertEqual((d['rooms_total'], d['occupied_tonight'], d['occupancy']), (2, 1, 50))
        self.assertEqual([a['guest'] for a in d['arrivals']], ['Asha'])
        self.assertEqual((d['revenue_today'], d['payments_due']['amount']), ('500.00', '1500.00'))
        self.assertEqual(len(d['series']), 30)
        self.assertEqual(d['series'][-1]['bookings'], 1)

    def test_calendar(self):
        d = call(RoomCalendarView.as_view(), self.viewer, start=str(self.today), days='7').data
        self.assertEqual([r['name'] for r in d['rooms']], ['101', '102'])
        self.assertEqual([(b['room_id'], b['guest']) for b in d['bookings']], [(self.r1.id, 'Asha')])

    def test_walk_in(self):
        base = {'room': self.r2.id, 'check_in': str(self.today), 'check_out': str(self.today + timedelta(days=1)),
                'guests': 2, 'guest_name': 'Ravi Kumar', 'guest_phone': '+91 98765 43210'}
        self.assertEqual(call(WalkInBookingView.as_view(), self.viewer, 'post', base).status_code, 403)
        # Room 101 is taken tonight.
        self.assertEqual(call(WalkInBookingView.as_view(), self.desk, 'post', {**base, 'room': self.r1.id}).status_code, 400)
        r = call(WalkInBookingView.as_view(), self.desk, 'post', {**base, 'check_in_now': True})
        self.assertEqual((r.status_code, r.data['status'], r.data['total_amount']), (201, 'CHECKED_IN', '1500.00'))
        walkin = User.objects.get(pk=r.data['customer'])
        self.assertEqual((walkin.role, walkin.is_active, walkin.has_usable_password()), ('CUSTOMER', False, False))
        # With an existing guest's email the booking joins their account; payment taken at the desk.
        tomorrow = self.today + timedelta(days=1)
        r = call(WalkInBookingView.as_view(), self.admin, 'post', {**base, 'check_in': str(tomorrow), 'check_out': str(tomorrow + timedelta(days=1)),
                                                                 'guest_email': 'GUEST@x.com', 'payment': {'method': 'UPI'}})
        self.assertEqual((r.status_code, r.data['customer'], r.data['balance_due']), (201, self.guest.id, '0.00'))
        # Staff emails can't be used for a guest; front desk can't take money.
        bad = {**base, 'check_in': str(tomorrow + timedelta(days=5)), 'check_out': str(tomorrow + timedelta(days=6))}
        self.assertIn('guest_email', call(WalkInBookingView.as_view(), self.desk, 'post', {**bad, 'guest_email': 'admin@x.com'}).data)
        self.assertEqual(call(WalkInBookingView.as_view(), self.viewer, 'post', bad).status_code, 403)

    def test_staff_notifications_and_exports(self):
        Booking.objects.filter(pk=self.b.pk).update(cancel_request_status='PENDING', cancel_request_reason='Sick', cancel_requested_at=timezone.now())
        kinds = {i['kind'] for i in call(StaffNotificationsView.as_view(), self.desk).data}
        self.assertTrue({'cancel_request', 'new_booking'} <= kinds)
        csv_resp = call(BookingsExportView.as_view(), self.viewer)
        self.assertEqual(csv_resp['Content-Type'], 'text/csv; charset=utf-8')
        self.assertIn('CX-', csv_resp.content.decode('utf-8-sig'))
        self.assertEqual(call(CollectionsExportView.as_view(), self.desk).status_code, 403)   # no payments.report
        self.assertIn('Cash', call(CollectionsExportView.as_view(), self.admin).content.decode('utf-8-sig'))

    def test_msp_overview(self):
        d = call(OrganizationViewSet.as_view({'get': 'overview'}), self.msp_admin).data
        row = d['organizations'][0]
        self.assertEqual((row['name'], row['rooms'], row['occupancy'], row['revenue_month'], row['health']), ('Hotel', 2, 50, '500.00', 'good'))
        self.assertEqual(d['totals']['organizations'], 1)
        self.assertEqual(call(OrganizationViewSet.as_view({'get': 'overview'}), self.guest).status_code, 403)
