"""Two-step verification endpoints (/api/auth/2fa/...). See apps.core.two_factor."""
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.activity.utils import log_activity
from apps.core import login_guard, two_factor
from .auth import login_response


def _too_many(user):
    minutes = login_guard.locked_minutes(user.email)
    if minutes:
        return Response({'error': f'Too many failed attempts. Try again in {minutes} minute{"s" if minutes != 1 else ""}.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)
    return None


def _wrong_code(user):
    if login_guard.record_failure(user.email):
        return Response({'error': f'Too many wrong codes. This account is locked for {settings.LOGIN_LOCKOUT_MINUTES} minutes.'},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)
    return Response({'error': 'That code isn’t right. Use the newest code from your app, or a backup code.'},
                    status=status.HTTP_400_BAD_REQUEST)


class _LoginStep(APIView):
    """Steps of sign-in that happen before the user has tokens."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'login'

    def get_throttles(self):
        return [ScopedRateThrottle()]


class TwoFactorVerifyView(_LoginStep):
    """Second step of sign-in: {mfa_token, code} → tokens."""

    def post(self, request):
        user = two_factor.read_challenge(request.data.get('mfa_token'), 'verify')
        if not user:
            return Response({'error': 'This sign-in has expired. Please enter your password again.'}, status=status.HTTP_401_UNAUTHORIZED)
        blocked = _too_many(user)
        if blocked:
            return blocked
        if not two_factor.verify(user, request.data.get('code')):
            return _wrong_code(user)
        login_guard.clear_failures(user.email)
        return login_response(request, user)


def _setup_user(request):
    """Signed-in user, or (during a required first-time setup) the mfa_token holder."""
    if request.user and request.user.is_authenticated:
        return request.user, False
    return two_factor.read_challenge(request.data.get('mfa_token'), 'setup'), True


class TwoFactorSetupView(APIView):
    """Start setup: returns {secret, otpauth_uri} for the authenticator app's QR code."""
    permission_classes = [AllowAny]  # signed in, or holding a setup mfa_token
    throttle_scope = 'login'

    def get_throttles(self):
        return [ScopedRateThrottle()]

    def post(self, request):
        user, _ = _setup_user(request)
        if not user:
            return Response({'error': 'Please sign in again.'}, status=status.HTTP_401_UNAUTHORIZED)
        if user.role == 'CUSTOMER':
            return Response({'error': 'Not available for guest accounts.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            secret, uri = two_factor.start_setup(user)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'secret': secret, 'otpauth_uri': uri, 'account': user.email})


class TwoFactorEnableView(APIView):
    """Confirm setup with a code: {code[, mfa_token]} → {backup_codes} (+ tokens when finishing sign-in)."""
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def get_throttles(self):
        return [ScopedRateThrottle()]

    def post(self, request):
        user, during_login = _setup_user(request)
        if not user:
            return Response({'error': 'Please sign in again.'}, status=status.HTTP_401_UNAUTHORIZED)
        blocked = _too_many(user)
        if blocked:
            return blocked
        try:
            codes = two_factor.enable(user, request.data.get('code'))
        except ValueError as exc:
            login_guard.record_failure(user.email)
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        login_guard.clear_failures(user.email)
        log_activity(request, 'UPDATE', obj=user, organization=user.organization, actor=user,
                     changes={'two_factor': ['off', 'on']})
        if during_login:
            return login_response(request, user, extra={'backup_codes': codes})
        return Response({'backup_codes': codes, **two_factor.status(user)})


class TwoFactorStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(two_factor.status(request.user))


class TwoFactorDisableView(APIView):
    """Turn off: {password, code}. Not allowed for roles that require it."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if two_factor.required_for(user):
            return Response({'error': 'Two-step verification is required for your role and can’t be turned off.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(request.data.get('password') or ''):
            return Response({'error': 'Your password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        if not two_factor.verify(user, request.data.get('code')):
            return Response({'error': 'That code isn’t right.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.disable(user)
        log_activity(request, 'UPDATE', obj=user, organization=user.organization, changes={'two_factor': ['on', 'off']})
        return Response(two_factor.status(user))


class TwoFactorBackupCodesView(APIView):
    """New backup codes (old ones stop working): {code}."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not two_factor.is_enabled(request.user):
            return Response({'error': 'Turn on two-step verification first.'}, status=status.HTTP_400_BAD_REQUEST)
        if not two_factor.verify(request.user, request.data.get('code')):
            return Response({'error': 'That code isn’t right.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'backup_codes': two_factor.regenerate_backup_codes(request.user), **two_factor.status(request.user)})
