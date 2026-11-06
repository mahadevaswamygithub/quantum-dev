"""Guest booking emails sent as the organization (Settings → Email)."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.core.mail import get_connection
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, BookingSettings, Property, Room
from apps.bookings.views import BookingViewSet
from apps.tenants.models import OrgEmailSettings, Organization
from apps.tenants.views import OrganizationViewSet
from apps.users.models import OrgRole, User


def call(view, user, method='get', data=None, **kwargs):
    request = getattr(APIRequestFactory(), method)('/', data or {}, format='json')
    force_authenticate(request, user=user)
    return view(request, **kwargs)


@override_settings(BOOKING_EMAILS_ASYNC=False, DEFAULT_FROM_EMAIL='corex.noreply@gmail.com')
class OrgEmailTests(TestCase):
    def setUp(self):
        self.org = Organization(schema_name='h', name='Sea View Inn', tenant_type='STP', org_type='ROOM_BOOKING',
                                contact_email='desk@seaview.example')
        self.org.auto_create_schema = False
        self.org.save()
        self.admin = User.objects.create_user(username='a', email='a@example.com', password='x' * 10, first_name='A', last_name='B',
                                              organization=self.org, role='STP_ADMIN')
        self.desk = User.objects.create_user(username='d', email='d@example.com', password='x' * 10, first_name='D', last_name='E',
                                             organization=self.org, role='STP_USER',
                                             access_role=OrgRole.objects.get(organization=self.org, name='Front desk'))
        self.guest = User.objects.create_user(username='g@example.com', email='g@example.com', password='x' * 10,
                                              first_name='Gita', last_name='R', role='CUSTOMER')
        prop = Property.objects.create(organization=self.org, name='Main')
        self.room = Room.objects.create(organization=self.org, property=prop, name='101', price_per_night=Decimal('1500'))

    def book(self):
        data = {'room': self.room.id, 'check_in': (date.today() + timedelta(days=5)).isoformat(),
                'check_out': (date.today() + timedelta(days=7)).isoformat(), 'guests': 1}
        r = call(BookingViewSet.as_view({'post': 'create'}), self.guest, 'post', data)
        self.assertEqual(r.status_code, 201, r.data)
        return Booking.objects.get(pk=r.data['id'])

    def act(self, user, booking, action):
        return call(BookingViewSet.as_view({'post': action}), user, 'post', pk=booking.id)

    # ── default: CoreX sends on the property's behalf ─────────────────
    def test_confirmed_booking_email_is_from_the_property_with_pdf(self):
        self.book()  # auto-confirm is on by default
        self.assertEqual(len(mail.outbox), 1)
        m = mail.outbox[0]
        self.assertEqual(m.to, ['g@example.com'])
        self.assertIn('Sea View Inn', m.from_email)
        self.assertIn('corex.noreply@gmail.com', m.from_email)
        self.assertEqual(m.reply_to, ['desk@seaview.example'])
        self.assertIn('confirmed', m.subject)
        self.assertEqual(m.attachments[0][2], 'application/pdf')

    def test_request_then_confirm_then_cancel(self):
        BookingSettings.objects.create(organization=self.org, auto_confirm=False)
        b = self.book()
        self.assertIn('request received', mail.outbox[-1].subject)
        self.act(self.desk, b, 'confirm')
        self.assertIn('confirmed', mail.outbox[-1].subject)
        self.act(self.guest, b, 'cancel')
        self.assertIn('cancelled', mail.outbox[-1].subject)
        self.assertEqual(len(mail.outbox), 3)

    def test_check_out_sends_thank_you_with_review_link(self):
        b = self.book()
        Booking.objects.filter(pk=b.pk).update(status='CHECKED_IN')
        self.act(self.desk, b, 'check_out')
        self.assertIn('how was it', mail.outbox[-1].subject)
        self.assertIn('/book/me/trips', mail.outbox[-1].body)

    def test_switched_off(self):
        OrgEmailSettings.objects.create(organization=self.org, send_booking_emails=False)
        self.book()
        self.assertEqual(len(mail.outbox), 0)

    # ── the property's own email account ──────────────────────────────
    def _custom(self):
        view = OrganizationViewSet.as_view({'patch': 'mine_email'})
        r = call(view, self.admin, 'patch', {'mode': 'CUSTOM', 'smtp_host': 'smtp.seaview.example', 'smtp_port': 587,
                                              'smtp_username': 'bookings@seaview.example', 'smtp_password': 's3cret-pw',
                                              'from_email': 'bookings@seaview.example'})
        self.assertEqual(r.status_code, 200, r.data)
        return r

    def test_password_is_encrypted_and_never_returned(self):
        r = self._custom()
        self.assertNotIn('smtp_password', r.data)
        self.assertTrue(r.data['has_password'])
        cfg = OrgEmailSettings.objects.get(organization=self.org)
        self.assertNotIn('s3cret-pw', cfg.smtp_password_encrypted)
        from apps.core.crypto import decrypt
        self.assertEqual(decrypt(cfg.smtp_password_encrypted), 's3cret-pw')

    def test_custom_account_is_used_and_falls_back_if_it_fails(self):
        self._custom()
        locmem = lambda cfg: get_connection('django.core.mail.backends.locmem.EmailBackend')  # noqa: E731
        with patch('apps.core.email._custom_connection', side_effect=locmem):
            self.book()
        self.assertIn('bookings@seaview.example', mail.outbox[-1].from_email)

        class Broken:
            def send_messages(self, _messages):
                raise OSError('auth failed')
        with patch('apps.core.email._custom_connection', return_value=Broken()), self.assertLogs('apps.core.email', 'ERROR'):
            Booking.objects.all().delete()
            self.book()
        self.assertIn('corex.noreply@gmail.com', mail.outbox[-1].from_email)  # delivered via the platform instead

    def test_custom_mode_needs_server_details(self):
        r = call(OrganizationViewSet.as_view({'patch': 'mine_email'}), self.admin, 'patch', {'mode': 'CUSTOM'})
        self.assertEqual(r.status_code, 400)

    def test_only_settings_managers(self):
        self.assertEqual(call(OrganizationViewSet.as_view({'get': 'mine_email'}), self.desk).status_code, 403)

    def test_send_test_email(self):
        r = call(OrganizationViewSet.as_view({'post': 'mine_email_test'}), self.admin, 'post')
        self.assertEqual((r.status_code, r.data['last_test_ok']), (200, True))
        self.assertEqual(mail.outbox[-1].to, ['a@example.com'])
        with patch('django.core.mail.backends.locmem.EmailBackend.send_messages', side_effect=OSError('nope')):
            r = call(OrganizationViewSet.as_view({'post': 'mine_email_test'}), self.admin, 'post')
        self.assertEqual((r.status_code, r.data['last_test_ok']), (400, False))
        self.assertIn('nope', r.data['error'])
