"""Attendance viewset."""
import csv
import io

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.access import HRScopedMixin
from ..models import AttendanceRecord, User
from ..serializers import AttendanceSerializer


class AttendanceViewSet(HRScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceSerializer
    hr_perm = 'hr.attendance'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Employees read their own attendance; marking/editing is staff-only.
        if self.action not in ('list', 'retrieve', 'summary', 'export'):
            self.require_hr_perm()

    def get_queryset(self):
        qs = self.hr_queryset(AttendanceRecord.objects.select_related('user').order_by('-date'))
        month = self.request.query_params.get('month')   # YYYY-MM

        if month:
            year, m = month.split('-')
            qs = qs.filter(date__year=year, date__month=m)
        return qs

    def perform_create(self, serializer):
        target = serializer.validated_data.get('user')
        if target is not None:
            self.hr_target_user(target.id)  # must be someone this staff member can see
        serializer.save(marked_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        qs = self.get_queryset()
        return Response({
            'present': qs.filter(status='PRESENT').count(),
            'absent': qs.filter(status='ABSENT').count(),
            'leave': qs.filter(status='LEAVE').count(),
            'half_day': qs.filter(status='HALF_DAY').count(),
            'total': qs.count(),
        })

    @action(detail=False, methods=['post'], url_path='bulk_mark')
    def bulk_mark(self, request):
        date = request.data.get('date')
        records = request.data.get('records', [])
        allowed = set(User.objects.filter(organization_id__in=self._visible_org_ids()).values_list('id', flat=True))
        if any(int(rec.get('user_id', 0) or 0) not in allowed for rec in records):
            return Response({'error': 'Some of these users are not in your organization.'}, status=403)
        created, updated = 0, 0
        for rec in records:
            obj, is_new = AttendanceRecord.objects.update_or_create(
                user_id=rec['user_id'], date=date,
                defaults={
                    'status': rec.get('status', 'PRESENT'),
                    'check_in': rec.get('check_in'),
                    'check_out': rec.get('check_out'),
                    'marked_by': request.user,
                }
            )
            if is_new:
                created += 1
            else:
                updated += 1
        return Response({'created': created, 'updated': updated})

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        qs = self.get_queryset()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['User', 'Date', 'Status', 'Check In', 'Check Out', 'Hours'])
        for a in qs:
            writer.writerow([
                a.user.get_full_name(), a.date, a.status,
                a.check_in or '', a.check_out or '', a.hours_worked or '',
            ])
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="attendance.csv"'
        return response
