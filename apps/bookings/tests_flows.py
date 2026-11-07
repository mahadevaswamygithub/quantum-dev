"""
Database-backed tests for the booking/payment safety rules:
cross-organization booking, payment-window expiry, idempotent payment
confirmation (browser callback + webhook), and refunds when a paid booking
can't be honoured. Views are called directly through APIRequestFactory, so
django-tenants' hostname routing isn't involved.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings import services
from apps.bookings.models import Booking, Payment, Property, Room
from apps.bookings.views import BookingViewSet, RazorpayWebhookView
from apps.tenants.models import Organization
from apps.users.models import User


def make_org(name):
    org = Organization(schema_name=name, name=name, tenant_type='STP', org_type='ROOM_BOOKING')
    org.auto_create_schema = False  # no Postgres schema needed for these tests
    org.save()
    return org


def make_room(org):
    prop = Property.objects.create(organization=org, name=f'{org.name} HQ')
    return Room.objects.create(organization=org, property=prop, name='101', capacity=2, price_per_night=Decimal('1000'))


def make_customer(org, username):
    return User.objects.create_user(username=username, email=f'{username}@example.com', password='x' * 10,
                                    organization=org, role='CUSTOMER')


class BookingFlowTestBase(TestCase):
    def setUp(self):
        self.org = make_org('hotel_a')
        self.room = make_room(self.org)
        self.alice = make_customer(self.org, 'alice')
        self.bob = make_customer(self.org, 'bob')
        self.check_in = date.today() + timedelta(days=7)
        self.check_out = self.check_in + timedelta(days=2)

    def book(self, customer, **overrides):
        data = {'room': self.room.id, 'check_in': self.check_in.isoformat(),
                'check_out': self.check_out.isoformat(), 'guests': 1, **overrides}
        request = APIRequestFactory().post('/bookings/reservations/', data, format='json')
        force_authenticate(request, user=customer)
        return BookingViewSet.as_view({'post': 'create'})(request)

    def pending(self, customer, minutes_ago=0):
        booking = Booking.objects.create(
            organization=self.org, property=self.room.property, room=self.room, customer=customer,
            check_in=self.check_in, check_out=self.check_out, status='PENDING', total_amount=Decimal('2000'),
        )
        if minutes_ago:
            Booking.objects.filter(pk=booking.pk).update(created_at=timezone.now() - timedelta(minutes=minutes_ago))
            booking.refresh_from_db()
        return booking

    def payment_for(self, booking, order_id='order_1'):
        return Payment.objects.create(booking=booking, razorpay_order_id=order_id, amount=booking.total_amount)


class CrossOrganizationBookingTests(BookingFlowTestBase):
    def test_one_guest_account_books_at_another_property(self):
        other_org = make_org('hotel_b')
        other_room = make_room(other_org)
        response = self.book(self.alice, room=other_room.id)
        self.assertEqual(response.status_code, 201, response.data)
        booking = Booking.objects.get(room=other_room)
        # Belongs to the room's property, so only hotel_b's staff see it.
        self.assertEqual((booking.organization, booking.customer), (other_org, self.alice))
        self.assertEqual(response.data['organization_name'], 'hotel_b')

    def test_cannot_book_at_closed_or_non_booking_org(self):
        other_org = make_org('hotel_b')
        other_room = make_room(other_org)
        for change in ({'is_active': False}, {'is_active': True, 'org_type': 'HOTEL'}):
            with self.subTest(**change):
                Organization.objects.filter(pk=other_org.pk).update(**change)
                response = self.book(self.alice, room=other_room.id)
                self.assertEqual(response.status_code, 400)
                self.assertIn('room', response.data)
        self.assertFalse(Booking.objects.filter(room=other_room).exists())

    def test_customer_can_book_own_orgs_room(self):
        response = self.book(self.alice)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Booking.objects.get().organization, self.org)


class PaymentWindowTests(BookingFlowTestBase):
    def test_fresh_pending_booking_holds_the_room(self):
        self.pending(self.alice)
        self.assertEqual(self.book(self.bob).status_code, 400)

    def test_stale_pending_booking_no_longer_holds_the_room(self):
        self.pending(self.alice, minutes_ago=30)
        self.assertEqual(self.book(self.bob).status_code, 201)

    def test_expire_stale_pending_marks_reason(self):
        stale = self.pending(self.alice, minutes_ago=30)
        fresh = self.pending(self.bob)
        self.assertEqual(services.expire_stale_pending(), 1)
        stale.refresh_from_db()
        fresh.refresh_from_db()
        self.assertEqual((stale.status, stale.cancel_reason), ('CANCELLED', 'EXPIRED'))
        self.assertEqual(fresh.status, 'PENDING')

    @override_settings(BOOKING_PAYMENT_WINDOW_MINUTES=60)
    def test_window_is_configurable(self):
        self.pending(self.alice, minutes_ago=30)
        self.assertEqual(self.book(self.bob).status_code, 400)


class ConfirmPaymentTests(BookingFlowTestBase):
    def test_pending_booking_is_confirmed_once(self):
        booking = self.pending(self.alice)
        payment = self.payment_for(booking)
        booking, outcome = services.confirm_payment(payment, 'pay_1', 'sig')
        self.assertEqual((booking.status, outcome), ('CONFIRMED', services.CONFIRMED))
        # The webhook arriving after the browser callback is a no-op.
        _, outcome = services.confirm_payment(payment, 'pay_1')
        self.assertEqual(outcome, services.ALREADY_PROCESSED)
        self.assertEqual(Payment.objects.get().status, 'PAID')

    def test_expired_booking_is_revived_when_room_still_free(self):
        booking = self.pending(self.alice, minutes_ago=30)
        services.expire_stale_pending()
        booking, outcome = services.confirm_payment(self.payment_for(booking), 'pay_1')
        self.assertEqual((booking.status, booking.cancel_reason, outcome), ('CONFIRMED', '', services.CONFIRMED))

    @patch('apps.bookings.services.refund_payment')
    def test_expired_booking_whose_room_was_taken_is_refunded(self, refund):
        booking = self.pending(self.alice, minutes_ago=30)
        services.expire_stale_pending()
        self.assertEqual(self.book(self.bob).status_code, 201)  # Bob takes the room
        booking, outcome = services.confirm_payment(self.payment_for(booking), 'pay_1')
        self.assertEqual((booking.status, booking.cancel_reason, outcome), ('CANCELLED', 'UNAVAILABLE', services.REFUNDED))
        refund.assert_called_once()
        self.assertEqual(Booking.objects.filter(status__in=['PENDING', 'CONFIRMED']).count(), 1)

    @patch('apps.bookings.services.refund_payment')
    def test_customer_cancelled_booking_is_not_revived(self, refund):
        booking = self.pending(self.alice)
        Booking.objects.filter(pk=booking.pk).update(status='CANCELLED', cancel_reason='CUSTOMER', cancelled_at=timezone.now())
        booking, outcome = services.confirm_payment(self.payment_for(booking), 'pay_1')
        self.assertEqual((booking.status, outcome), ('CANCELLED', services.REFUNDED))
        refund.assert_called_once()

    @patch('apps.bookings.services.refund_payment')
    def test_duplicate_payment_is_refunded(self, refund):
        booking = self.pending(self.alice)
        services.confirm_payment(self.payment_for(booking, 'order_1'), 'pay_1')
        booking, outcome = services.confirm_payment(self.payment_for(booking, 'order_2'), 'pay_2')
        self.assertEqual((booking.status, outcome), ('CONFIRMED', services.REFUNDED))
        refund.assert_called_once()

    @patch('apps.bookings.services.refund_payment', side_effect=services.RefundFailed('gateway down'))
    def test_failed_refund_is_reported(self, _refund):
        booking = self.pending(self.alice)
        Booking.objects.filter(pk=booking.pk).update(status='CANCELLED', cancel_reason='STAFF', cancelled_at=timezone.now())
        _, outcome = services.confirm_payment(self.payment_for(booking), 'pay_1')
        self.assertEqual(outcome, services.NEEDS_MANUAL_REFUND)


@override_settings(RAZORPAY_WEBHOOK_SECRET='whsec', RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
class RazorpayWebhookTests(BookingFlowTestBase):
    def post(self, payload, signature_ok=True):
        from razorpay.errors import SignatureVerificationError
        client = MagicMock()
        if not signature_ok:
            client.utility.verify_webhook_signature.side_effect = SignatureVerificationError('bad')
        request = APIRequestFactory().post('/bookings/razorpay/webhook/', payload, format='json',
                                           HTTP_X_RAZORPAY_SIGNATURE='sig')
        with patch('apps.bookings.views.get_client', return_value=client):
            return RazorpayWebhookView.as_view()(request)

    def event(self, order_id='order_1'):
        return {'event': 'payment.captured',
                'payload': {'payment': {'entity': {'id': 'pay_1', 'order_id': order_id}}}}

    def test_bad_signature_is_rejected_and_nothing_changes(self):
        booking = self.pending(self.alice)
        self.payment_for(booking)
        self.assertEqual(self.post(self.event(), signature_ok=False).status_code, 400)
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'PENDING')

    def test_captured_payment_confirms_booking_without_browser(self):
        booking = self.pending(self.alice)
        self.payment_for(booking)
        response = self.post(self.event())
        self.assertEqual((response.status_code, response.data['status']), (200, services.CONFIRMED))
        booking.refresh_from_db()
        self.assertEqual(booking.status, 'CONFIRMED')

    def test_unknown_order_is_acknowledged(self):
        self.assertEqual(self.post(self.event('order_unknown')).status_code, 200)

    @override_settings(RAZORPAY_WEBHOOK_SECRET='')
    def test_unconfigured_webhook_is_refused(self):
        self.assertEqual(self.post(self.event()).status_code, 503)


class PayAtPropertyTests(BookingFlowTestBase):
    """No Razorpay keys (the test default) → bookings are pay-at-property."""

    def test_booking_without_gateway_is_pay_at_property(self):
        response = self.book(self.alice)
        self.assertEqual((response.status_code, response.data['payment_method']), (201, 'AT_PROPERTY'))

    def test_pay_at_property_booking_never_expires_and_keeps_holding_the_room(self):
        self.book(self.alice)
        Booking.objects.update(created_at=timezone.now() - timedelta(hours=5))
        self.assertEqual(services.expire_stale_pending(), 0)
        self.assertEqual(self.book(self.bob).status_code, 400)

    @override_settings(RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
    def test_booking_with_gateway_and_auto_confirm_is_pay_now(self):
        from apps.bookings.models import BookingSettings
        BookingSettings.objects.update_or_create(organization=self.org, defaults={'auto_confirm': True})
        data = self.book(self.alice).data
        self.assertEqual((data['status'], data['payment_method']), ('PENDING', 'ONLINE'))

    def test_retrying_same_booking_returns_existing_reservation(self):
        first = self.book(self.alice)
        again = self.book(self.alice)
        self.assertEqual((again.status_code, again.data['id']), (200, first.data['id']))
        self.assertEqual(Booking.objects.count(), 1)

    def test_overlapping_own_booking_gets_helpful_message(self):
        self.book(self.alice)
        response = self.book(self.alice, check_out=(self.check_out + timedelta(days=1)).isoformat())
        self.assertEqual(response.status_code, 400)
        self.assertIn('My Bookings', str(response.data['room']))


class PublicBrowsingTests(BookingFlowTestBase):
    def get(self, org_id, room_id=None, **params):
        from apps.bookings.views import PublicRoomListView
        path = f'/bookings/public/{org_id}/rooms/'
        request = APIRequestFactory().get(path, params)
        return PublicRoomListView.as_view()(request, org_id=org_id, **({'room_id': room_id} if room_id else {}))

    def test_anonymous_visitor_sees_active_rooms_only(self):
        Room.objects.create(organization=self.org, property=self.room.property, name='Closed', price_per_night=1, is_active=False)
        response = self.get(self.org.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([r['name'] for r in response.data], ['101'])
        self.assertIsNone(response.data[0]['available'])

    def test_availability_for_requested_dates(self):
        self.pending(self.alice)  # holds the room for these dates
        stay = {'check_in': self.check_in.isoformat(), 'check_out': self.check_out.isoformat()}
        self.assertFalse(self.get(self.org.id, **stay).data[0]['available'])
        later = {'check_in': (self.check_out + timedelta(days=3)).isoformat(),
                 'check_out': (self.check_out + timedelta(days=4)).isoformat()}
        self.assertTrue(self.get(self.org.id, **later).data[0]['available'])

    def test_guests_filter_hides_small_rooms(self):
        self.assertEqual(self.get(self.org.id, guests=3).data, [])

    def test_non_booking_or_inactive_org_is_404(self):
        self.org.org_type = 'HOTEL'
        self.org.save()
        self.assertEqual(self.get(self.org.id).status_code, 404)
        self.org.org_type, self.org.is_active = 'ROOM_BOOKING', False
        self.org.save()
        self.assertEqual(self.get(self.org.id).status_code, 404)

    def test_room_detail_of_other_org_is_404(self):
        other = make_room(make_org('hotel_c'))
        self.assertEqual(self.get(self.org.id, room_id=other.id).status_code, 404)


class ApprovalModeTests(BookingFlowTestBase):
    def set_auto(self, value):
        from apps.bookings.models import BookingSettings
        BookingSettings.objects.update_or_create(organization=self.org, defaults={'auto_confirm': value})

    def act(self, customer, booking_id, action):
        request = APIRequestFactory().post(f'/bookings/reservations/{booking_id}/{action}/')
        force_authenticate(request, user=customer)
        return BookingViewSet.as_view({'post': action})(request, pk=booking_id)

    def test_auto_confirm_without_gateway_confirms_immediately(self):
        self.set_auto(True)
        data = self.book(self.alice).data
        self.assertEqual((data['status'], data['payment_method']), ('CONFIRMED', 'AT_PROPERTY'))

    @override_settings(RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
    def test_manual_approval_waits_and_cannot_be_paid_yet(self):
        self.set_auto(False)
        data = self.book(self.alice).data
        self.assertEqual((data['status'], data['can_pay_online']), ('PENDING', False))
        response = self.act(self.alice, data['id'], 'create_order')
        self.assertEqual(response.status_code, 400)
        self.assertIn('confirmed', response.data['error'])

    @override_settings(RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
    def test_guest_can_pay_online_after_approval(self):
        self.set_auto(False)
        booking_id = self.book(self.alice).data['id']
        Booking.objects.filter(pk=booking_id).update(status='CONFIRMED')  # staff approved
        client = MagicMock()
        client.order.create.return_value = {'id': 'order_9'}
        client.auth = ('k', 's')
        with patch('apps.bookings.views.get_client', return_value=client),              patch('apps.bookings.services.get_client', return_value=client):
            response = self.act(self.alice, booking_id, 'create_order')
        self.assertEqual((response.status_code, response.data['order_id']), (200, 'order_9'))
        # Paying settles the already-confirmed booking.
        booking, outcome = services.confirm_payment(Payment.objects.get(razorpay_order_id='order_9'), 'pay_9')
        self.assertEqual((booking.status, outcome), ('CONFIRMED', services.CONFIRMED))

    @override_settings(RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
    def test_paid_booking_cannot_be_paid_again(self):
        booking = self.pending(self.alice)
        services.confirm_payment(self.payment_for(booking), 'pay_1')
        self.assertEqual(self.act(self.alice, booking.id, 'create_order').status_code, 400)


class PlatformGuestAccountTests(BookingFlowTestBase):
    def test_guest_can_sign_up_without_a_property(self):
        from apps.bookings.serializers import CustomerRegisterSerializer
        s = CustomerRegisterSerializer(data={'username': 'g@example.com', 'email': 'g@example.com',
                                             'first_name': 'G', 'last_name': 'H', 'password': 'Blue-Harbor-2931'})
        self.assertTrue(s.is_valid(), s.errors)
        user = s.save()
        self.assertEqual((user.role, user.organization_id), ('CUSTOMER', None))

    def test_trip_carries_its_property_details(self):
        from apps.bookings.models import BookingSettings
        import datetime
        self.org.address, self.org.contact_phone = '1 Beach Rd', '+91 1'
        self.org.save()
        BookingSettings.objects.create(organization=self.org, check_in_time=datetime.time(13, 0))
        data = self.book(self.alice).data
        self.assertEqual((data['organization_name'], data['organization_address'], data['organization_phone'],
                          data['check_in_time'], data['check_out_time']),
                         ('hotel_a', '1 Beach Rd', '+91 1', '13:00', '11:00'))


class CancellationWindowTests(BookingFlowTestBase):
    def setUp(self):
        super().setUp()
        from apps.bookings.models import BookingSettings
        self.rules = BookingSettings.objects.create(organization=self.org, free_cancellation_hours=24)

    def confirmed(self, check_in, customer=None):
        return Booking.objects.create(
            organization=self.org, property=self.room.property, room=self.room, customer=customer or self.alice,
            check_in=check_in, check_out=check_in + timedelta(days=1), status='CONFIRMED',
            payment_method='AT_PROPERTY', total_amount=Decimal('1000'),
        )

    def cancel(self, user, booking):
        request = APIRequestFactory().post(f'/bookings/reservations/{booking.id}/cancel/')
        force_authenticate(request, user=user)
        return BookingViewSet.as_view({'post': 'cancel'})(request, pk=booking.id)

    def test_deadline_is_in_property_local_time(self):
        b = self.confirmed(date(2030, 12, 1))
        self.assertEqual(services.cancellation_deadline(b).isoformat(), '2030-11-30T14:00:00+05:30')

    def test_guest_cancels_within_window(self):
        b = self.confirmed(date.today() + timedelta(days=10))
        self.assertTrue(services.guest_can_cancel(b))
        response = self.cancel(self.alice, b)
        self.assertEqual(response.status_code, 200, response.data)
        b.refresh_from_db()
        self.assertEqual((b.status, b.cancel_reason), ('CANCELLED', 'CUSTOMER'))

    def test_guest_blocked_after_window_but_staff_can_cancel(self):
        self.rules.free_cancellation_hours = 24 * 30
        self.rules.save()
        b = self.confirmed(date.today() + timedelta(days=3))
        response = self.cancel(self.alice, b)
        self.assertEqual(response.status_code, 400)
        self.assertIn('window', response.data['error'])
        staff = User.objects.create_user(username='desk', email='desk@example.com', password='x' * 10,
                                         organization=self.org, role='STP_ADMIN')
        self.assertEqual(self.cancel(staff, b).status_code, 200)
        b.refresh_from_db()
        self.assertEqual((b.status, b.cancel_reason), ('CANCELLED', 'STAFF'))

    def test_unconfirmed_booking_can_be_withdrawn_until_check_in(self):
        self.rules.free_cancellation_hours = 24 * 30
        self.rules.save()
        b = self.pending(self.alice)
        self.assertTrue(services.guest_can_cancel(b))

    @patch('apps.bookings.services.refund_payment')
    def test_paid_booking_cancelled_in_time_is_refunded(self, refund):
        b = self.confirmed(date.today() + timedelta(days=10))
        Payment.objects.create(booking=b, razorpay_order_id='o', amount=b.total_amount, status='PAID')
        self.assertEqual(self.cancel(self.alice, b).status_code, 200)
        refund.assert_called_once()
        b.refresh_from_db()
        self.assertEqual((b.status, b.cancel_reason), ('CANCELLED', 'REFUNDED'))

    @patch('apps.bookings.services.refund_payment', side_effect=services.RefundFailed('down'))
    def test_failed_refund_keeps_booking_active(self, _refund):
        b = self.confirmed(date.today() + timedelta(days=10))
        Payment.objects.create(booking=b, razorpay_order_id='o', amount=b.total_amount, status='PAID')
        self.assertEqual(self.cancel(self.alice, b).status_code, 502)
        b.refresh_from_db()
        self.assertEqual(b.status, 'CONFIRMED')


class GuestPrivacyTests(BookingFlowTestBase):
    def setUp(self):
        super().setUp()
        self.staff = User.objects.create_user(username='desk', email='desk@example.com', password='x' * 10,
                                              organization=self.org, role='STP_ADMIN')
        self.other_org = make_org('hotel_b')
        self.other_room = make_room(self.other_org)
        self.other_staff = User.objects.create_user(username='desk_b', email='desk_b@example.com', password='x' * 10,
                                                    organization=self.other_org, role='STP_ADMIN')

    def _get(self, view, user, path, **kwargs):
        request = APIRequestFactory().get(path)
        force_authenticate(request, user=user)
        return view(request, **kwargs)

    def test_staff_cannot_see_or_manage_guest_accounts(self):
        from apps.users.views.users import UserViewSet
        response = self._get(UserViewSet.as_view({'get': 'list'}), self.staff, '/users/list/')
        usernames = [u['username'] for u in (response.data['results'] if isinstance(response.data, dict) else response.data)]
        self.assertNotIn('alice', usernames)
        self.assertIn('desk', usernames)
        request = APIRequestFactory().delete(f'/users/list/{self.alice.id}/')
        force_authenticate(request, user=self.staff)
        self.assertEqual(UserViewSet.as_view({'delete': 'destroy'})(request, pk=self.alice.id).status_code, 404)

    def test_guest_list_only_shows_this_propertys_guests_and_stays(self):
        from apps.bookings.views import GuestListView
        self.book(self.alice)                                  # alice at hotel_a
        self.book(self.bob, room=self.other_room.id)           # bob only at hotel_b
        rows = self._get(GuestListView.as_view(), self.staff, '/bookings/guests/').data
        self.assertEqual([r['email'] for r in rows], ['alice@example.com'])
        rows_b = self._get(GuestListView.as_view(), self.other_staff, '/bookings/guests/').data
        self.assertEqual([r['email'] for r in rows_b], ['bob@example.com'])

    def test_booking_keeps_guest_details_from_booking_time(self):
        booking_id = self.book(self.alice).data['id']
        self.alice.first_name, self.alice.email = 'Changed', 'new@example.com'
        self.alice.save()
        b = Booking.objects.get(pk=booking_id)
        self.assertEqual(b.guest_email, 'alice@example.com')

    def test_guest_timeline_hides_staff_names_and_ips(self):
        from apps.activity.models import ActivityLog
        booking_id = self.book(self.alice).data['id']
        ActivityLog.objects.create(actor=self.staff, actor_username='desk', actor_role='STP_ADMIN', organization=self.org,
                                   action='UPDATE', model_name='Booking', object_id=str(booking_id), ip_address='10.0.0.9')
        rows = self._get(BookingViewSet.as_view({'get': 'history'}), self.alice, '/h/', pk=booking_id).data
        self.assertTrue(rows)
        self.assertNotIn('desk', [r['actor_username'] for r in rows])
        self.assertTrue(all(r['ip_address'] is None for r in rows))

    def _delete_me(self, password):
        from apps.users.views.users import UserViewSet
        request = APIRequestFactory().delete('/users/me/', {'password': password}, format='json')
        force_authenticate(request, user=self.alice)
        return UserViewSet.as_view({'delete': 'me'})(request)

    def test_delete_account_blocked_with_upcoming_booking(self):
        self.book(self.alice)
        response = self._delete_me('x' * 10)
        self.assertEqual(response.status_code, 400)
        self.assertIn('upcoming', response.data['error'])

    def test_delete_account_anonymizes_but_keeps_property_records(self):
        booking_id = self.book(self.alice).data['id']
        Booking.objects.filter(pk=booking_id).update(status='CHECKED_OUT')
        self.assertEqual(self._delete_me('wrong').status_code, 400)
        self.assertEqual(self._delete_me('x' * 10).status_code, 204)
        self.alice.refresh_from_db()
        self.assertFalse(self.alice.is_active)
        self.assertTrue(self.alice.email.endswith('@deleted.invalid'))
        self.assertFalse(self.alice.has_usable_password())
        b = Booking.objects.get(pk=booking_id)
        self.assertEqual((b.guest_email, b.customer_id), ('alice@example.com', self.alice.id))


class GuestActivityTests(BookingFlowTestBase):
    def test_guest_actions_stay_off_the_staff_activity_log(self):
        from apps.activity.models import ActivityLog
        from apps.activity.views import ActivityLogViewSet
        booking_id = self.book(self.alice).data['id']
        # The guest's booking event is kept for the booking's own timeline...
        self.assertTrue(ActivityLog.objects.filter(model_name='Booking', object_id=str(booking_id), actor_role='CUSTOMER').exists())
        # ...but the staff Activity Log doesn't list guest actions.
        admin = User.objects.create_user(username='boss', email='boss@example.com', password='x' * 10,
                                         organization=self.org, role='STP_ADMIN')
        request = APIRequestFactory().get('/activity/')
        force_authenticate(request, user=admin)
        data = ActivityLogViewSet.as_view({'get': 'list'})(request).data
        rows = data['results'] if isinstance(data, dict) else data
        self.assertFalse([r for r in rows if r.get('actor_role') == 'CUSTOMER'])
