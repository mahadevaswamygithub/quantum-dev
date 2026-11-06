"""Desk payments, daily collection, reviews, and resending staff invites."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.core import mail
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, Payment, Property, Review, Room
from apps.bookings.views import (
    BookingViewSet, CollectionReportView, PublicReviewListView, StaffReviewListView, StaffReviewReplyView,
)
from apps.tenants.models import Organization
from apps.users.models import OrgRole, User


def call(view, user, method='get', data=None, path='/', **kwargs):
    request = getattr(APIRequestFactory(), method)(path, data or {}, format='json')
    if user is not None:
        force_authenticate(request, user=user)
    return view(request, **kwargs)


class Base(TestCase):
    def setUp(self):
        self.org = Organization(schema_name='h', name='Hotel', tenant_type='STP', org_type='ROOM_BOOKING')
        self.org.auto_create_schema = False
        self.org.save()
        role = lambda name: OrgRole.objects.get(organization=self.org, name=name)  # noqa: E731
        mk = lambda u, r, ar=None: User.objects.create_user(  # noqa: E731
            username=u, email=f'{u}@example.com', password='x' * 10, first_name=u.title(), last_name='Lee',
            organization=self.org if r != 'CUSTOMER' else None, role=r, access_role=role(ar) if ar else None)
        self.admin = mk('admin', 'STP_ADMIN')
        self.cashier = mk('cash', 'STP_USER', 'Cashier')
        self.desk = mk('desk', 'STP_USER', 'Front desk')
        self.viewer = mk('view', 'STP_USER', 'Viewer')
        self.guest = mk('guest', 'CUSTOMER')
        prop = Property.objects.create(organization=self.org, name='Main')
        self.room = Room.objects.create(organization=self.org, property=prop, name='101', price_per_night=Decimal('1000'))
        self.booking = Booking.objects.create(
            organization=self.org, property=prop, room=self.room, customer=self.guest, guest_name='Guest Lee',
            check_in=date.today(), check_out=date.today() + timedelta(days=1),
            status='CONFIRMED', payment_method='AT_PROPERTY', total_amount=Decimal('1000'))

    def booking_action(self, user, action, data=None):
        return call(BookingViewSet.as_view({'post': action}), user, 'post', data, pk=self.booking.id)


class DeskPaymentTests(Base):
    def test_partial_then_rest_and_no_overpay(self):
        r = self.booking_action(self.cashier, 'record_payment', {'method': 'CASH', 'amount': '400'})
        self.assertEqual((r.status_code, r.data['amount_paid'], r.data['balance_due'], r.data['is_paid']), (200, '400.00', '600.00', False))
        self.assertEqual(self.booking_action(self.cashier, 'record_payment', {'method': 'UPI', 'amount': '700'}).status_code, 400)
        r = self.booking_action(self.desk, 'record_payment', {'method': 'UPI'})  # defaults to what's owed
        self.assertEqual((r.status_code, r.data['balance_due'], r.data['is_paid']), (200, '0.00', True))
        self.assertEqual(self.booking_action(self.cashier, 'record_payment', {'method': 'CASH'}).status_code, 400)
        p = Payment.objects.filter(booking=self.booking, method='CASH').get()
        self.assertEqual(p.collected_by, self.cashier)

    def test_viewer_cannot_record_and_bad_method_rejected(self):
        self.assertEqual(self.booking_action(self.viewer, 'record_payment', {'method': 'CASH'}).status_code, 403)
        self.assertEqual(self.booking_action(self.cashier, 'record_payment', {'method': 'ONLINE'}).status_code, 400)

    def test_cash_refund_needs_no_gateway(self):
        self.booking_action(self.cashier, 'record_payment', {'method': 'CASH'})
        r = self.booking_action(self.cashier, 'refund')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Payment.objects.get(booking=self.booking).status, 'REFUNDED')

    @override_settings(RAZORPAY_KEY_ID='k', RAZORPAY_KEY_SECRET='s')
    def test_online_order_charges_only_the_balance(self):
        self.booking_action(self.cashier, 'record_payment', {'method': 'CASH', 'amount': '250'})
        client = MagicMock()
        client.order.create.return_value = {'id': 'order_x'}
        client.auth = ('k', 's')
        with patch('apps.bookings.views.get_client', return_value=client), patch('apps.bookings.services.get_client', return_value=client):
            r = self.booking_action(self.guest, 'create_order')
        self.assertEqual((r.status_code, r.data['amount']), (200, 75000))  # ₹750 in paise

    def test_daily_collection(self):
        self.booking_action(self.cashier, 'record_payment', {'method': 'CASH', 'amount': '300'})
        self.booking_action(self.cashier, 'record_payment', {'method': 'CARD', 'amount': '700'})
        view = CollectionReportView.as_view()
        self.assertEqual(call(view, self.desk).status_code, 403)  # front desk has no report access
        data = call(view, self.cashier).data
        self.assertEqual((data['totals']['CASH'], data['totals']['CARD'], data['gross'], data['count']),
                         ('300.00', '700.00', '1000.00', 2))
        self.assertEqual(data['payments'][0]['collected_by'], 'Cash Lee')


class ReviewTests(Base):
    def test_review_lifecycle(self):
        self.assertEqual(self.booking_action(self.guest, 'review', {'rating': 5}).status_code, 400)  # not checked out
        Booking.objects.filter(pk=self.booking.pk).update(status='CHECKED_OUT')
        self.assertEqual(self.booking_action(self.desk, 'review', {'rating': 5}).status_code, 403)
        self.assertEqual(self.booking_action(self.guest, 'review', {'rating': 9}).status_code, 400)
        r = self.booking_action(self.guest, 'review', {'rating': 4, 'comment': 'Nice', 'private_feedback': 'AC noisy'})
        self.assertEqual((r.status_code, r.data['review']['rating'], r.data['can_review']), (201, 4, False))
        self.assertEqual(self.booking_action(self.guest, 'review', {'rating': 5}).status_code, 400)  # only once

        public = call(PublicReviewListView.as_view(), None, org_id=self.org.id).data
        self.assertEqual((public[0]['rating'], public[0]['guest']), (4, 'Guest L.'))
        self.assertNotIn('private_feedback', public[0])

        staff = call(StaffReviewListView.as_view(), self.desk).data
        self.assertEqual((staff['average'], staff['reviews'][0]['private_feedback']), (4.0, 'AC noisy'))
        review = Review.objects.get()
        reply = StaffReviewReplyView.as_view()
        self.assertEqual(call(reply, self.desk, 'post', {'reply': 'Thanks'}, review_id=review.id).status_code, 403)
        self.assertEqual(call(reply, self.admin, 'post', {'reply': 'Thanks!'}, review_id=review.id).status_code, 200)
        self.assertEqual(call(PublicReviewListView.as_view(), None, org_id=self.org.id).data[0]['reply'], 'Thanks!')

    def test_rating_shows_on_public_info(self):
        from apps.tenants.views import OrganizationViewSet
        Booking.objects.filter(pk=self.booking.pk).update(status='CHECKED_OUT')
        self.booking_action(self.guest, 'review', {'rating': 3})
        info = call(OrganizationViewSet.as_view({'get': 'public_info'}), None, pk=self.org.id).data
        self.assertEqual((info['rating_avg'], info['rating_count']), (3.0, 1))


class ResendInviteTests(Base):
    def resend(self, user, target):
        from apps.users.views import UserViewSet
        return call(UserViewSet.as_view({'post': 'resend_invite'}), user, 'post', pk=target.id)

    def test_resend_to_pending_invite_only(self):
        invited = User.objects.create(username='new', email='new@example.com', first_name='N', last_name='U',
                                      organization=self.org, role='STP_USER',
                                      access_role=OrgRole.objects.get(organization=self.org, name='Viewer'))
        invited.set_unusable_password()
        invited.save()
        from apps.users.serializers import UserSerializer
        self.assertTrue(UserSerializer(invited).data['invite_pending'])
        self.assertEqual(self.resend(self.admin, invited).status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/reset-password/', mail.outbox[0].body)
        self.assertEqual(self.resend(self.admin, self.cashier).status_code, 400)  # already has a password
        self.assertEqual(self.resend(self.desk, invited).status_code, 403)         # no users.manage
        with patch('apps.core.email.send_mail', side_effect=OSError('down')):
            self.assertEqual(self.resend(self.admin, invited).status_code, 502)


class VoucherTests(Base):
    def get(self, user):
        return call(BookingViewSet.as_view({'get': 'voucher'}), user, pk=self.booking.id)

    def test_guest_and_staff_download_pdf_others_cannot(self):
        self.booking_action(self.cashier, 'record_payment', {'method': 'CASH', 'amount': '400'})
        Review.objects.all().delete()
        r = self.get(self.guest)
        self.assertEqual((r.status_code, r['Content-Type']), (200, 'application/pdf'))
        self.assertTrue(r.content.startswith(b'%PDF'))
        self.assertIn(f'booking-CX-{self.booking.id:06d}.pdf', r['Content-Disposition'])
        self.assertEqual(self.get(self.desk).status_code, 200)              # staff with bookings.view
        stranger = User.objects.create_user(username='x', email='x@example.com', password='x' * 10, role='CUSTOMER')
        self.assertEqual(self.get(stranger).status_code, 404)              # someone else's booking
