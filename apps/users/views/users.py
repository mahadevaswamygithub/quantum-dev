"""User CRUD viewset."""
import csv
import io

from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.permissions import OrganizationScopedQuerysetMixin
from ..models import User, UserDocument
from ..serializers import (
    UserCreateSerializer,
    UserDocumentSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserViewSet(OrganizationScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all().order_by('-created_at')
    organization_lookup = 'organization'  # MSP/STP admins & users see users within their org(s)

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related('organization').order_by('-created_at')

        if user.role == 'EMPLOYEE':
            return qs.filter(id=user.id)
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
            return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get', 'put'], url_path='me')
    def me(self, request):
        if request.method == 'GET':
            return Response(UserSerializer(request.user, context={'request': request}).data)
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(UserSerializer(request.user, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='toggle_active')
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'is_active': user.is_active, 'message': f"User {'activated' if user.is_active else 'deactivated'}"})

    @action(detail=True, methods=['put'], url_path='change_role')
    def change_role(self, request, pk=None):
        user = self.get_object()
        role = request.data.get('role')
        if role not in dict(User.ROLE_CHOICES):
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
        user.role = role
        user.save()
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
        User.objects.filter(id__in=ids).update(is_active=True)
        return Response({'message': f'{len(ids)} users activated'})

    @action(detail=False, methods=['post'], url_path='bulk_deactivate')
    def bulk_deactivate(self, request):
        ids = request.data.get('user_ids', [])
        User.objects.filter(id__in=ids).update(is_active=False)
        return Response({'message': f'{len(ids)} users deactivated'})

    @action(detail=False, methods=['post'], url_path='bulk_delete')
    def bulk_delete(self, request):
        ids = request.data.get('user_ids', [])
        User.objects.filter(id__in=ids).delete()
        return Response({'message': f'{len(ids)} users deleted'})

    @action(detail=False, methods=['post'], url_path='bulk_change_role')
    def bulk_change_role(self, request):
        ids = request.data.get('user_ids', [])
        role = request.data.get('role')
        if role not in dict(User.ROLE_CHOICES):
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)
        User.objects.filter(id__in=ids).update(role=role)
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
