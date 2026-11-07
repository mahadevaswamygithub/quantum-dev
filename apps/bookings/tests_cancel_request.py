"""Cancellation requests after the free-cancellation window."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, BookingSettings, Payment, Property, Room
from apps.bookings.views import BookingViewSet
from apps.tenants.models import Organization
from apps.users.models import OrgRole, User


@override_settings(BOOKING_EMAILS_ASYNC=False)
class CancelRequestTests(TestCase):
    def setUp(self):
        self.org = Organization(schema_name='c', name='Hotel', tenant_type='STP', org_type='ROOM_BOOKING',
                                contact_email='desk@hotel.example')
        self.org.auto_create_schema = False
        self.org.save()
        BookingSettings.objects.create(organization=self.org, free_cancellation_hours=48)
        role = lambda n: OrgRole.objects.get(organization=self.org, name=n)  # noqa: E731
        self.admin = User.objects.create_user(username='a', email='a@x.com', password='x' * 12, role='STP_ADMIN', organization=self.org)
        self.desk = User.objects.create_user(username='d', email='d@x.com', password='x' * 12, role='STP_USER',
                                             organization=self.org, access_role=role('Front desk'))
        self.viewer = User.objects.create_user(username='v', email='v@x.com', password='x' * 12, role='STP_USER',
                                               organization=self.org, access_role=role('Viewer'))
        self.guest = User.objects.create_user(username='g', email='g@x.com', password='x' * 12, role='CUSTOMER', first_name='Asha')
        prop = Property.objects.create(organization=self.org, name='Main')
        room = Room.objects.create(organization=self.org, property=prop, name='101', price_per_night=Decimal('2000'))
        # Check-in tomorrow: inside the 48h window, so free cancellation is over.
        self.booking = Booking.objects.create(
            organization=self.org, property=prop, room=room, customer=self.guest, guest_name='Asha', guest_email='g@x.com',
            check_in=date.today() + timedelta(days=1), check_out=date.today() + timedelta(days=2),
            status='CONFIRMED', payment_method='ONLINE', total_amount=Decimal('2000'))

    def act(self, user, action, data=None):
        request = APIRequestFactory().post('/', data or {}, format='json')
        force_authenticate(request, user=user)
        return BookingViewSet.as_view({'post': action})(request, pk=self.booking.id)

    def test_guest_cannot_cancel_but_can_request(self):
        self.assertEqual(self.act(self.guest, 'cancel').status_code, 400)
        self.assertEqual(self.act(self.guest, 'request_cancellation', {'reason': 'x'}).status_code, 400)  # reason too short
        r = self.act(self.guest, 'request_cancellation', {'reason': 'Family emergency, cannot travel.'})
        self.assertEqual((r.status_code, r.data['cancel_request_status'], r.data['status']), (200, 'PENDING', 'CONFIRMED'))
        self.assertEqual(self.act(self.guest, 'request_cancellation', {'reason': 'Again please'}).status_code, 400)  # one open request
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['desk@hotel.example', 'g@x.com'])
        self.assertIn('Family emergency', mail.outbox[1].body + mail.outbox[0].body)

    def test_other_people_cannot_request_or_decide(self):
        other = User.objects.create_user(username='o', email='o@x.com', password='x' * 12, role='CUSTOMER')
        self.assertIn(self.act(other, 'request_cancellation', {'reason': 'Not mine at all'}).status_code, (403, 404))
        self.act(self.guest, 'request_cancellation', {'reason': 'Plans changed, sorry.'})
        self.assertEqual(self.act(self.viewer, 'cancel_request_decision', {'decision': 'approve'}).status_code, 403)
        self.assertEqual(self.act(self.guest, 'cancel_request_decision', {'decision': 'approve'}).status_code, 403)

    def test_decline_keeps_booking_and_tells_guest(self):
        self.act(self.guest, 'request_cancellation', {'reason': 'Plans changed, sorry.'})
        mail.outbox.clear()
        r = self.act(self.desk, 'cancel_request_decision', {'decision': 'decline', 'note': 'Fully prepaid non-refundable rate.'})
        self.assertEqual((r.status_code, r.data['status'], r.data['cancel_request_status']), (200, 'CONFIRMED', 'DECLINED'))
        self.assertIn('Fully prepaid', mail.outbox[0].body)
        # Declined: the guest may ask again.
        self.assertEqual(self.act(self.guest, 'request_cancellation', {'reason': 'Please reconsider.'}).status_code, 200)

    def test_approve_with_and_without_refund(self):
        Payment.objects.create(booking=self.booking, razorpay_order_id='o1', amount=Decimal('2000'), status='PAID')
        self.act(self.guest, 'request_cancellation', {'reason': 'Flight cancelled.'})
        # Front desk has no refund permission.
        self.assertEqual(self.act(self.desk, 'cancel_request_decision', {'decision': 'approve', 'refund': True}).status_code, 403)
        with patch('apps.bookings.views.services.refund_payment') as refund:
            r = self.act(self.admin, 'cancel_request_decision', {'decision': 'approve', 'refund': True, 'note': 'Refund issued.'})
        refund.assert_called_once()
        self.assertEqual((r.data['status'], r.data['cancel_reason'], r.data['cancel_request_status']), ('CANCELLED', 'REFUNDED', 'APPROVED'))
        self.assertIn('approved your cancellation request', mail.outbox[-1].body)

    def test_approve_without_refund_and_no_request(self):
        self.assertEqual(self.act(self.admin, 'cancel_request_decision', {'decision': 'approve'}).status_code, 400)
        self.act(self.guest, 'request_cancellation', {'reason': 'Change of plans.'})
        r = self.act(self.desk, 'cancel_request_decision', {'decision': 'approve'})
        self.assertEqual((r.data['status'], r.data['cancel_reason']), ('CANCELLED', 'REQUESTED'))
