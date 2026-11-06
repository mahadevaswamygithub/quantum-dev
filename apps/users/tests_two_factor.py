"""Two-step verification: setup, sign-in, backup codes, required roles, admin reset."""
import time

import pyotp
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.core.crypto import decrypt
from apps.tenants.models import Organization
from apps.users.models import User, UserTwoFactor
from apps.users.views import (
    LoginView, TwoFactorBackupCodesView, TwoFactorDisableView, TwoFactorEnableView, TwoFactorSetupView, TwoFactorVerifyView,
    UserViewSet,
)

PW = 'Blue-Harbor-2931'


def post(view, data, user=None, **kw):
    request = APIRequestFactory().post('/', data, format='json')
    if user:
        force_authenticate(request, user=user)
    return (view.as_view() if hasattr(view, 'as_view') else view)(request, **kw)


def current_code(user, offset=0):
    secret = decrypt(UserTwoFactor.objects.get(user=user).secret_encrypted)
    return pyotp.TOTP(secret).at(int(time.time()) + offset)


@override_settings(TWO_FACTOR_REQUIRED_ROLES=['MSP_ADMIN'], LOGIN_MAX_FAILURES=5)
class TwoFactorTests(TestCase):
    def setUp(self):
        cache.clear()
        self.org = Organization(schema_name='o', name='Org', tenant_type='STP', org_type='ROOM_BOOKING')
        self.org.auto_create_schema = False
        self.org.save()
        self.admin = User.objects.create_user(username='a', email='admin@example.com', password=PW, first_name='A', last_name='D',
                                              organization=self.org, role='STP_ADMIN')
        self.staff = User.objects.create_user(username='s', email='staff@example.com', password=PW, first_name='S', last_name='T',
                                              organization=self.org, role='STP_USER')

    def login(self, user):
        return post(LoginView, {'email': user.email, 'password': PW})

    def turn_on(self, user):
        self.assertEqual(post(TwoFactorSetupView, {}, user=user).status_code, 200)
        r = post(TwoFactorEnableView, {'code': current_code(user)}, user=user)
        self.assertEqual(r.status_code, 200, r.data)
        return r.data['backup_codes']

    def test_without_2fa_login_is_unchanged(self):
        self.assertIn('access', self.login(self.staff).data)

    def test_setup_then_login_needs_code(self):
        r = post(TwoFactorSetupView, {}, user=self.staff)
        self.assertTrue(r.data['otpauth_uri'].startswith('otpauth://totp/CoreX:'))
        self.assertNotIn(r.data['secret'], UserTwoFactor.objects.get(user=self.staff).secret_encrypted)  # stored encrypted
        backup = self.turn_on(self.staff)
        self.assertEqual(len(backup), 10)

        r = self.login(self.staff)
        self.assertTrue(r.data['mfa_required'])
        self.assertNotIn('access', r.data)                    # password alone isn't enough
        token = r.data['mfa_token']
        self.assertEqual(post(TwoFactorVerifyView, {'mfa_token': token, 'code': '000000'}).status_code, 400)
        ok = post(TwoFactorVerifyView, {'mfa_token': token, 'code': current_code(self.staff, 30)})
        self.assertIn('access', ok.data)

    def test_code_cannot_be_reused_and_backup_codes_work_once(self):
        backup = self.turn_on(self.staff)  # the setup code is now used up
        token = self.login(self.staff).data['mfa_token']
        self.assertEqual(post(TwoFactorVerifyView, {'mfa_token': token, 'code': current_code(self.staff)}).status_code, 400)
        self.assertIn('access', post(TwoFactorVerifyView, {'mfa_token': token, 'code': backup[0]}).data)
        token = self.login(self.staff).data['mfa_token']
        self.assertEqual(post(TwoFactorVerifyView, {'mfa_token': token, 'code': backup[0]}).status_code, 400)

    def test_bad_or_wrong_purpose_token_rejected(self):
        self.turn_on(self.staff)
        self.assertEqual(post(TwoFactorVerifyView, {'mfa_token': 'garbage', 'code': '123456'}).status_code, 401)

    @override_settings(TWO_FACTOR_REQUIRED_ROLES=['STP_ADMIN'])
    def test_required_role_must_set_up_during_login(self):
        r = self.login(self.admin)
        self.assertTrue(r.data['mfa_setup_required'])
        token = r.data['mfa_token']
        self.assertEqual(post(TwoFactorSetupView, {'mfa_token': token}).status_code, 200)
        done = post(TwoFactorEnableView, {'mfa_token': token, 'code': current_code(self.admin)})
        self.assertIn('access', done.data)
        self.assertEqual(len(done.data['backup_codes']), 10)
        # and can't turn it off
        self.assertEqual(post(TwoFactorDisableView, {'password': PW, 'code': done.data['backup_codes'][0]}, user=self.admin).status_code, 400)

    def test_disable_needs_password_and_code(self):
        backup = self.turn_on(self.staff)
        self.assertEqual(post(TwoFactorDisableView, {'password': 'nope', 'code': backup[0]}, user=self.staff).status_code, 400)
        self.assertEqual(post(TwoFactorDisableView, {'password': PW, 'code': backup[1]}, user=self.staff).status_code, 200)
        self.assertIn('access', self.login(self.staff).data)

    def test_new_backup_codes_replace_old(self):
        old = self.turn_on(self.staff)
        new = post(TwoFactorBackupCodesView, {'code': old[0]}, user=self.staff).data['backup_codes']
        token = self.login(self.staff).data['mfa_token']
        self.assertEqual(post(TwoFactorVerifyView, {'mfa_token': token, 'code': old[1]}).status_code, 400)
        self.assertIn('access', post(TwoFactorVerifyView, {'mfa_token': token, 'code': new[0]}).data)

    def test_admin_resets_lost_phone(self):
        self.turn_on(self.staff)
        r = post(UserViewSet.as_view({'post': 'reset_2fa'}), {}, user=self.admin, pk=self.staff.pk)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('access', self.login(self.staff).data)
