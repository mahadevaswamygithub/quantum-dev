"""Registration, login, token refresh, and password reset/change views."""
from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings

from ..models import User, ImpersonationToken
from ..serializers import UserRegistrationSerializer, UserSerializer
from apps.activity.utils import log_activity


class RefreshTokenView(TokenRefreshView):
    """Refresh access token"""
    pass


class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response({
            'message': 'Registration successful. Welcome emails have been sent.',
            'user': {
                'username': user.username,
                'email': user.email,
                'organization': user.organization.name,
                'role': user.role
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=email, password=password)
        if not user:
            # Try authenticating with email directly
            try:
                u = User.objects.get(email=email)
                if u.check_password(password):
                    user = u
            except User.DoesNotExist:
                pass

        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'error': 'Account is deactivated'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        # actor=user passed explicitly — request.user is still AnonymousUser
        # at this point (login hasn't attached anything to the request).
        log_activity(request, 'LOGIN', actor=user, organization=user.organization)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user, context={'request': request}).data,
        })


class LogoutView(APIView):
    """
    JWTs are stateless here (no blacklist app installed) so this endpoint
    doesn't actually invalidate anything — its only job is to record the
    LOGOUT activity event before the frontend clears its tokens. Called by
    authAPI.logout() right before tokenStorage.clear().
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log_activity(request, 'LOGOUT', organization=request.user.organization)
        return Response({'message': 'Logged out'})


class ImpersonationExchangeView(APIView):
    """Exchanges a single-use impersonation code (minted by
    OrganizationViewSet.impersonate) for real JWTs. Called from a fresh
    browser tab that has no session yet, so it's necessarily AllowAny —
    safety comes from the code being unguessable, short-lived, and
    consumed on first use, not from the caller being authenticated."""
    permission_classes = [AllowAny]

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

    def post(self, request):
        email = request.data.get('email', '').lower().strip()
        try:
            user = User.objects.get(email=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
            send_mail(
                subject='Password Reset Request',
                message=f'Click the link to reset your password: {reset_url}',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
        except User.DoesNotExist:
            pass  # Don't reveal if email exists
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
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=400)

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link'}, status=400)

        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired token'}, status=400)

        user.set_password(new_password)
        user.save()
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
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=400)

        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password changed successfully'})
