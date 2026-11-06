"""Registration, login, token refresh, and password reset/change views."""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils import timezone
from django.conf import settings

from ..models import User, ImpersonationToken
from ..serializers import UserRegistrationSerializer, UserSerializer
from apps.activity.utils import log_activity
from apps.core import login_guard


class RefreshTokenView(TokenRefreshView):
    """Refresh access token"""
    pass


class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]
    throttle_scope = 'signup'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()] if self.request.method == 'POST' else []

    def get(self, request):
        """{enabled} — whether public organization sign-up is open (shows/hides the link)."""
        return Response({'enabled': settings.ALLOW_PUBLIC_ORG_SIGNUP})

    def create(self, request, *args, **kwargs):
        if not settings.ALLOW_PUBLIC_ORG_SIGNUP:
            return Response({'error': 'Sign-up is closed. Ask your service provider to create an account for you.'},
                            status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'message': 'Your organization is ready. You can sign in now.',
            'user': {
                'username': user.username,
                'email': user.email,
                'organization': user.organization.name,
                'role': user.role
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'  # per-IP limit; per-account lockout below

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        minutes = login_guard.locked_minutes(email)
        if minutes:
            return Response({'error': f'Too many failed attempts. Try again in {minutes} minute{"s" if minutes != 1 else ""}, '
                                      'or reset your password.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        user = authenticate(request, username=email, password=password)
        if not user:
            # Try authenticating with email directly
            u = User.objects.filter(email__iexact=email).first()
            if u and u.check_password(password):
                user = u

        if not user:
            if login_guard.record_failure(email):
                minutes = settings.LOGIN_LOCKOUT_MINUTES
                return Response({'error': f'Too many failed attempts. This account is locked for {minutes} minutes — '
                                          'or reset your password to get back in now.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        login_guard.clear_failures(email)

        if not user.is_active:
            return Response({'error': 'Account is deactivated'}, status=status.HTTP_403_FORBIDDEN)

        # Two-step verification: the password was right, now ask for a code
        # (or, for a role that requires it, set it up first).
        from apps.core import two_factor
        if two_factor.is_enabled(user):
            return Response({'mfa_required': True, 'mfa_token': two_factor.make_challenge(user, 'verify')})
        if two_factor.required_for(user):
            return Response({'mfa_setup_required': True, 'mfa_token': two_factor.make_challenge(user, 'setup')})
        return login_response(request, user)


def login_response(request, user, extra=None):
    """Issue tokens for a fully authenticated user (password + any 2FA)."""
    refresh = RefreshToken.for_user(user)
    update_last_login(None, user)
    # actor=user passed explicitly — request.user is still AnonymousUser
    # at this point. Staff sign-ins are audited; guest sign-ins aren't.
    if user.role != 'CUSTOMER':
        log_activity(request, 'LOGIN', actor=user, organization=user.organization)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user, context={'request': request}).data,
        **(extra or {}),
    })


class LogoutView(APIView):
    """Revokes this device's refresh token (sent as {refresh}) so it can't be
    reused, and records the LOGOUT event. Called by authAPI.logout() right
    before the frontend clears its tokens."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get('refresh')
        if refresh:
            try:
                token = RefreshToken(refresh)
                if str(token.get('user_id')) == str(request.user.id):
                    token.blacklist()
            except Exception:  # already expired/blacklisted/garbled — nothing left to revoke
                pass
        if request.user.role != 'CUSTOMER':
            log_activity(request, 'LOGOUT', organization=request.user.organization)
        return Response({'message': 'Logged out'})


class ImpersonationExchangeView(APIView):
    """Exchanges a single-use impersonation code (minted by
    OrganizationViewSet.impersonate) for real JWTs. Called from a fresh
    browser tab that has no session yet, so it's necessarily AllowAny —
    safety comes from the code being unguessable, short-lived, and
    consumed on first use, not from the caller being authenticated."""
    permission_classes = [AllowAny]
    throttle_scope = 'impersonation'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        code = request.data.get('code')
        try:
            token = ImpersonationToken.objects.get(code=code)
        except (ImpersonationToken.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'This impersonation link is invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        if token.used_at or token.expires_at < timezone.now():
            return Response({'error': 'This impersonation link has expired or was already used.'}, status=status.HTTP_400_BAD_REQUEST)

        token.used_at = timezone.now()
        token.save(update_fields=['used_at'])

        user = token.target_user
        refresh = RefreshToken.for_user(user)
        log_activity(
            request, 'LOGIN', actor=user, organization=user.organization,
            object_repr=f'Impersonated by {token.initiated_by.get_full_name()}',
        )
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user, context={'request': request}).data,
        })


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        return [ScopedRateThrottle()]

    def post(self, request):
        from apps.core.email import send_email
        email = (request.data.get('email') or '').strip()
        # Case-insensitive: "Kumar@corex.com" and "kumar@corex.com" are the
        # same mailbox. Deactivated/deleted accounts get nothing.
        user = User.objects.filter(email__iexact=email, is_active=True).first() if email else None
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            # Guests finish on the booking site's login, staff on the portal's.
            guest = '?guest=1' if user.role == 'CUSTOMER' else ''
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}{guest}"
            send_email(
                'Reset your CoreX password',
                f"Hello {user.first_name or ''},\n\n"
                f"We received a request to reset the password for {user.email}.\n\n"
                f"Set a new password here:\n{reset_url}\n\n"
                "If you didn't ask for this, you can ignore this email — your password won't change.\n",
                user.email,
            )  # failures are logged on the server; the response never reveals them
        # Same answer either way, so this can't be used to find out who has an account.
        return Response({'message': 'If this email exists, a reset link has been sent.'})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match'}, status=400)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link'}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired token'}, status=400)
        problems = login_guard.password_problems(new_password, user)
        if problems:
            return Response({'error': ' '.join(problems)}, status=400)

        user.set_password(new_password)
        user.save()
        login_guard.revoke_all_sessions(user)  # whoever had the old password is signed out
        login_guard.clear_failures(user.email)
        return Response({'message': 'Password reset successfully'})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect'}, status=400)
        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match'}, status=400)
        problems = login_guard.password_problems(new_password, request.user)
        if problems:
            return Response({'error': ' '.join(problems)}, status=400)

        request.user.set_password(new_password)
        request.user.save()
        # Sign out every other device; hand this one fresh tokens so it stays signed in.
        login_guard.revoke_all_sessions(request.user)
        refresh = RefreshToken.for_user(request.user)
        return Response({'message': 'Password changed. Other devices have been signed out.',
                         'access': str(refresh.access_token), 'refresh': str(refresh)})
