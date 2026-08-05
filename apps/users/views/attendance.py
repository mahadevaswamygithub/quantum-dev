"""Attendance viewset."""
import csv
import io

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import AttendanceRecord
from ..serializers import AttendanceSerializer


class AttendanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related('user').order_by('-date')
        user_id = self.request.query_params.get('user_id')
        month = self.request.query_params.get('month')   # YYYY-MM

        req_user = self.request.user
        if req_user.role == 'EMPLOYEE':
            qs = qs.filter(user=req_user)
        elif user_id:
            qs = qs.filter(user_id=user_id)

        if month:
            year, m = month.split('-')
            qs = qs.filter(date__year=year, date__month=m)
        return qs

    def perform_create(self, serializer):
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
