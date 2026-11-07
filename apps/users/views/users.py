"""User CRUD viewset."""
import csv
import io

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.access import ADMIN_TIERS, USER_TIERS, has_perm
from apps.core.permissions import OrganizationScopedQuerysetMixin
from apps.activity.utils import log_activity, diff_fields
from ..models import User, UserDocument
from ..serializers import (
    UserCreateSerializer,
    UserDocumentSerializer,
    UserSerializer,
    UserUpdateSerializer,
    MeUpdateSerializer,
)
# Not re-exported via ..serializers (it's a private helper, not a serializer)
# - same MSP/STP role-vs-org-type guard used by UserCreateSerializer /
# UserUpdateSerializer, reused here since these two actions bypass those
# serializers entirely and would otherwise skip the check.
from ..serializers.users import _check_role_matches_org_type, _resolve_access_role, invite_pending, send_invite_email

# Fields worth recording on a User UPDATE - matches UserUpdateSerializer.Meta.fields.
_USER_TRACKED_FIELDS = [
    'first_name', 'last_name', 'email', 'role',
    'phone', 'date_of_birth', 'address', 'employee_id',
    'daily_rate', 'is_active', 'organization_id',
]


# Roles that only ever see/act on their own account through this viewset,
# and the only actions they may use. Everything else (update, role changes,
# activation, deletes, bulk ops, exports) is staff-only - otherwise an
# employee could PUT their own record with role=STP_ADMIN.
SELF_SERVICE_ROLES = ('EMPLOYEE', 'CUSTOMER')
SELF_SERVICE_ACTIONS = {'list', 'retrieve', 'me', 'upload_picture', 'documents', 'delete_document'}
STAFF_TIERS = ADMIN_TIERS + USER_TIERS
READ_ACTIONS = {'list', 'retrieve', 'export_csv', 'export_json', 'statistics'}


class UserViewSet(OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all().order_by('-created_at')
    organization_lookup = 'organization'  # MSP/STP admins & users see users within their org(s)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        role = getattr(request.user, 'role', None)
        if role in SELF_SERVICE_ROLES and self.action not in SELF_SERVICE_ACTIONS:
            raise PermissionDenied('You can only view and update your own profile.')
        if role in STAFF_TIERS and self.action != 'me':
            own_photo = self.action == 'upload_picture' and str(kwargs.get('pk')) == str(request.user.id)
            reading = self.action in READ_ACTIONS or (self.action == 'documents' and request.method == 'GET')
            needed = 'users.view' if reading else 'users.manage'
            if not own_photo and not has_perm(request.user, needed):
                raise PermissionDenied('Your role doesn’t allow this.')

    def _guard_admin_target(self, *targets):
        """Non-admin staff can't deactivate, delete or re-role an admin."""
        if self.request.user.role not in ADMIN_TIERS and any(t.role in ADMIN_TIERS for t in targets):
            raise PermissionDenied('Only an admin can change admin accounts.')

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related('organization__parent_organization').order_by('-created_at')

        if user.role in SELF_SERVICE_ROLES:
            return qs.filter(id=user.id)
        # Guest (CUSTOMER) accounts are platform-wide and never managed by a
        # property's staff - staff see guests only via their own bookings.
        qs = qs.exclude(role='CUSTOMER')
        if user.role in ('MSP_ADMIN', 'MSP_USER', 'STP_ADMIN', 'STP_USER'):
            return self.get_organization_scoped_queryset(qs)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserSerializer

    def list(self, request):
        qs = self.get_queryset()
        serializer = UserSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def create(self, request):
        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            log_activity(request, 'CREATE', obj=user, organization=user.organization)
            return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        instance = serializer.instance
        # Self-profile edits (the `me` action) go through this same
        # serializer but not this hook - `me` calls serializer.save()
        # directly rather than routing through the viewset's update(), so
        # it's intentionally not logged here to avoid noise from routine
        # profile edits.
        changes = diff_fields(instance, serializer.validated_data, _USER_TRACKED_FIELDS)
        user = serializer.save()
        if changes:
            log_activity(self.request, 'UPDATE', obj=user, organization=user.organization, changes=changes)

    def perform_destroy(self, instance):
        self._guard_admin_target(instance)
        log_activity(self.request, 'DELETE', obj=instance, organization=instance.organization)
        instance.delete()

    @action(detail=False, methods=['get', 'put', 'delete'], url_path='me')
    def me(self, request):
        if request.method == 'DELETE':
            return self._delete_own_guest_account(request)
        if request.method == 'GET':
            return Response(UserSerializer(request.user, context={'request': request}).data)
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _delete_own_guest_account(self, request):
        """Guest self-service account deletion. Personal data is erased and
        the login disabled; past reservations stay on each property's records
        with the details captured at booking time (Booking.guest_*)."""
        from django.utils import timezone
        user = request.user
        if user.role != 'CUSTOMER':
            return Response({'error': 'Staff accounts are removed by an administrator.'}, status=status.HTTP_403_FORBIDDEN)
        if not user.check_password(request.data.get('password') or ''):
            return Response({'error': 'Your password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        upcoming = user.bookings.filter(status__in=['PENDING', 'CONFIRMED', 'CHECKED_IN'],
                                        check_out__gte=timezone.localdate()).count()
        if upcoming:
            return Response({'error': f'You have {upcoming} upcoming booking{"s" if upcoming > 1 else ""}. '
                                      'Cancel or complete them before deleting your account.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if user.profile_picture:
            user.profile_picture.delete(save=False)
        user.first_name, user.last_name = 'Deleted', 'guest'
        user.email = user.username = f'deleted-{user.pk}@deleted.invalid'
        user.phone = None
        user.address = None
        user.date_of_birth = None
        user.profile_picture = None
        user.is_active = False
        user.set_unusable_password()
        user.save()
        from apps.core.login_guard import revoke_all_sessions
        revoke_all_sessions(user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='reset_2fa')
    def reset_2fa(self, request, pk=None):
        """Lost phone: turn off someone's two-step verification. If their role
        requires it, they'll be asked to set it up again at next sign-in."""
        from apps.core import login_guard, two_factor
        user = self.get_object()
        self._guard_admin_target(user)
        if user.pk == request.user.pk:
            return Response({'error': 'You can’t reset your own two-step verification here.'}, status=status.HTTP_400_BAD_REQUEST)
        two_factor.disable(user)
        login_guard.revoke_all_sessions(user)
        log_activity(request, 'UPDATE', obj=user, organization=user.organization, changes={'two_factor': ['on', 'reset']})
        return Response({'message': f'Two-step verification reset for {user.email}.'})

    @action(detail=True, methods=['post'], url_path='resend_invite')
    def resend_invite(self, request, pk=None):
        """Re-send the set-your-password email to someone who hasn't set one yet."""
        user = self.get_object()
        if not invite_pending(user):
            return Response({'error': 'This person has already set their password.'}, status=status.HTTP_400_BAD_REQUEST)
        if not send_invite_email(user):
            return Response({'error': 'The email could not be sent. Check the email settings (Settings → Platform), then try again.'},
                            status=status.HTTP_502_BAD_GATEWAY)
        log_activity(request, 'UPDATE', obj=user, organization=user.organization, changes={'invite': ['', 'resent']})
        return Response({'message': f'Invite sent to {user.email}.'})

    @action(detail=True, methods=['post'], url_path='toggle_active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        self._guard_admin_target(user)
        was_active = user.is_active
        user.is_active = not user.is_active
        user.save()
        log_activity(request, 'UPDATE', obj=user, organization=user.organization, changes={'is_active': [str(was_active), str(user.is_active)]})
        return Response({'is_active': user.is_active, 'message': f"User {'activated' if user.is_active else 'deactivated'}"})

    @action(detail=True, methods=['put'], url_path='change_role')
    def change_role(self, request, pk=None):
        user = self.get_object()
        role = request.data.get('role')
        if role not in dict(User.ROLE_CHOICES) or role == 'CUSTOMER':
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
        self._guard_admin_target(user)
        if request.user.role not in ADMIN_TIERS and role in ADMIN_TIERS:
            raise PermissionDenied('Only an admin can make someone an admin.')
        try:
            _check_role_matches_org_type(role, user.organization)
            access_role = _resolve_access_role(role, user.organization, request.data.get('access_role_id'), user)
        except DRFValidationError as exc:
            return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        old_role = user.role
        user.role = role
        user.access_role = access_role
        user.save()
        if old_role != role:
            log_activity(request, 'UPDATE', obj=user, organization=user.organization, changes={'role': [old_role, role]})
        return Response({'role': user.role})

    @action(detail=True, methods=['post'], url_path='upload_picture')
    def upload_picture(self, request, pk=None):
        user = self.get_object()
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        user.profile_picture = request.FILES['file']
        user.save()
        return Response(UserSerializer(user, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'], url_path='documents')
    def documents(self, request, pk=None):
        user = self.get_object()
        if request.method == 'GET':
            docs = UserDocument.objects.filter(user=user)
            return Response(UserDocumentSerializer(docs, many=True, context={'request': request}).data)
        # POST
        doc_type = request.data.get('document_type')
        if not doc_type:
            return Response({'error': 'document_type required'}, status=status.HTTP_400_BAD_REQUEST)
        if 'file' not in request.FILES:
            return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)
        doc, _ = UserDocument.objects.get_or_create(user=user, document_type=doc_type)
        doc.file = request.FILES['file']
        doc.save()
        return Response(UserDocumentSerializer(doc, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'documents/(?P<doc_id>[^/.]+)')
    def delete_document(self, request, pk=None, doc_id=None):
        user = self.get_object()
        try:
            doc = UserDocument.objects.get(id=doc_id, user=user)
            doc.file.delete(save=False)
            doc.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except UserDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], url_path='bulk_activate')
    def bulk_activate(self, request):
        ids = request.data.get('user_ids', [])
        users = list(self.get_queryset().filter(id__in=ids).select_related('organization'))
        self._guard_admin_target(*users)
        ids = [u.id for u in users]
        User.objects.filter(id__in=ids).update(is_active=True)
        for u in users:
            log_activity(request, 'UPDATE', obj=u, organization=u.organization, changes={'is_active': ['False', 'True']})
        return Response({'message': f'{len(ids)} users activated'})

    @action(detail=False, methods=['post'], url_path='bulk_deactivate')
    def bulk_deactivate(self, request):
        ids = request.data.get('user_ids', [])
        users = list(self.get_queryset().filter(id__in=ids).select_related('organization'))
        self._guard_admin_target(*users)
        ids = [u.id for u in users]
        User.objects.filter(id__in=ids).update(is_active=False)
        for u in users:
            log_activity(request, 'UPDATE', obj=u, organization=u.organization, changes={'is_active': ['True', 'False']})
        return Response({'message': f'{len(ids)} users deactivated'})

    @action(detail=False, methods=['post'], url_path='bulk_delete')
    def bulk_delete(self, request):
        ids = request.data.get('user_ids', [])
        users = list(self.get_queryset().filter(id__in=ids).select_related('organization'))
        self._guard_admin_target(*users)
        ids = [u.id for u in users]
        for u in users:
            log_activity(request, 'DELETE', obj=u, organization=u.organization)
        User.objects.filter(id__in=ids).delete()
        return Response({'message': f'{len(ids)} users deleted'})

    @action(detail=False, methods=['post'], url_path='bulk_change_role')
    def bulk_change_role(self, request):
        ids = request.data.get('user_ids', [])
        role = request.data.get('role')
        if role not in dict(User.ROLE_CHOICES) or role == 'CUSTOMER':
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.role not in ADMIN_TIERS and role in ADMIN_TIERS:
            raise PermissionDenied('Only an admin can make someone an admin.')
        # Selected users can belong to different orgs, so the role/org-type
        # guard has to run per-user rather than once for the whole batch -
        # reject the whole request if any single one would end up mismatched.
        users = list(self.get_queryset().filter(id__in=ids).select_related('organization'))
        self._guard_admin_target(*users)
        ids = [u.id for u in users]
        for u in users:
            try:
                _check_role_matches_org_type(role, u.organization)
            except DRFValidationError as exc:
                return Response(exc.detail, status=status.HTTP_400_BAD_REQUEST)
        for u in users:
            u_role = _resolve_access_role(role, u.organization, None, u)
            User.objects.filter(pk=u.pk).update(role=role, access_role=u_role)
        for u in users:
            if u.role != role:
                log_activity(request, 'UPDATE', obj=u, organization=u.organization, changes={'role': [u.role, role]})
        return Response({'message': f'{len(ids)} users role updated to {role}'})

    # ── Export ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='export_csv')
    def export_csv(self, request):
        qs = self.get_queryset()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Username', 'Email', 'First Name', 'Last Name', 'Role', 'Organization', 'Active', 'Created'])
        for u in qs:
            writer.writerow([u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.organization_name or '', u.is_active, u.created_at.strftime('%Y-%m-%d')])
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="users.csv"'
        return response

    @action(detail=False, methods=['get'], url_path='export_json')
    def export_json(self, request):
        qs = self.get_queryset()
        return Response(UserSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='statistics')
    def statistics(self, request):
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'active': qs.filter(is_active=True).count(),
            'inactive': qs.filter(is_active=False).count(),
            'by_role': {r: qs.filter(role=r).count() for r, _ in User.ROLE_CHOICES},
        })
