"""Sign-in security: lockout, token revocation/rotation, password rules, closed sign-up."""
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.users.models import User
from apps.users.views import ChangePasswordView, LoginView, LogoutView, RefreshTokenView, UserRegistrationView

STRONG = 'Blue-Harbor-2931'


def post(view, data, user=None):
    request = APIRequestFactory().post('/', data, format='json')
    if user:
        force_authenticate(request, user=user)
    return view.as_view()(request)


@override_settings(LOGIN_MAX_FAILURES=3, LOGIN_LOCKOUT_MINUTES=15)
class AuthSecurityTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='s', email='staff@example.com', password=STRONG,
                                             first_name='S', last_name='T', role='STP_ADMIN')

    def login(self, password, email='staff@example.com'):
        return post(LoginView, {'email': email, 'password': password})

    def test_lockout_after_repeated_failures_even_with_right_password(self):
        self.assertEqual(self.login('wrong-1').status_code, 401)
        self.assertEqual(self.login('wrong-2').status_code, 401)
        self.assertEqual(self.login('wrong-3').status_code, 429)          # third failure locks
        r = self.login(STRONG)
        self.assertEqual(r.status_code, 429)                              # locked even with the right password
        self.assertIn('minute', r.data['error'])

    def test_success_clears_failures_and_records_last_login(self):
        self.login('wrong-1')
        self.login('wrong-2')
        self.assertEqual(self.login(STRONG).status_code, 200)
        self.assertEqual(self.login('wrong-3').status_code, 401)          # counter was reset
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_logout_revokes_refresh_token(self):
        refresh = self.login(STRONG).data['refresh']
        post(LogoutView, {'refresh': refresh}, user=self.user)
        self.assertEqual(post(RefreshTokenView, {'refresh': refresh}).status_code, 401)

    def test_refresh_rotates_and_old_token_stops_working(self):
        refresh = self.login(STRONG).data['refresh']
        r = post(RefreshTokenView, {'refresh': refresh})
        self.assertEqual(r.status_code, 200)
        self.assertIn('refresh', r.data)                                  # a new refresh token is issued
        self.assertEqual(post(RefreshTokenView, {'refresh': refresh}).status_code, 401)

    def test_password_change_signs_out_other_devices_keeps_this_one(self):
        other_device = self.login(STRONG).data['refresh']
        r = post(ChangePasswordView, {'old_password': STRONG, 'new_password': 'Green-Valley-8842',
                                      'confirm_password': 'Green-Valley-8842'}, user=self.user)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(post(RefreshTokenView, {'refresh': other_device}).status_code, 401)
        self.assertEqual(post(RefreshTokenView, {'refresh': r.data['refresh']}).status_code, 200)

    def test_weak_passwords_rejected(self):
        for weak in ('12345678', 'password', 'staff@example.com'):
            with self.subTest(weak=weak):
                r = post(ChangePasswordView, {'old_password': STRONG, 'new_password': weak, 'confirm_password': weak}, user=self.user)
                self.assertEqual(r.status_code, 400)

    @override_settings(ALLOW_PUBLIC_ORG_SIGNUP=False)  # the default, whatever the local .env says
    def test_public_signup_closed_by_default_and_never_creates_hidden_admin(self):
        data = {'username': 'own', 'email': 'own@example.com', 'first_name': 'O', 'last_name': 'W',
                'password': STRONG, 'organization_name': 'Open Hotel'}
        request = APIRequestFactory().get('/')
        self.assertEqual(UserRegistrationView.as_view()(request).data, {'enabled': False})
        self.assertEqual(post(UserRegistrationView, data).status_code, 403)
        with self.settings(ALLOW_PUBLIC_ORG_SIGNUP=True):
            r = post(UserRegistrationView, data)
        self.assertEqual(r.status_code, 201, r.data)
        owner = User.objects.get(email='own@example.com')
        self.assertEqual((owner.role, owner.organization.tenant_type, owner.organization.org_type), ('STP_ADMIN', 'STP', 'ROOM_BOOKING'))
        self.assertEqual(User.objects.filter(organization=owner.organization).count(), 1)   # no hidden "_admin"
        self.assertFalse(User.objects.filter(username__endswith='_admin', organization=owner.organization).exists())
