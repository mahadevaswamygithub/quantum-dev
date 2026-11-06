"""Salary settings, salary records, and salary advance viewsets."""
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.access import HRScopedMixin, has_perm
from ..models import AttendanceRecord, SalaryAdvance, SalaryRecord, SalarySettings
from ..serializers import SalaryAdvanceSerializer, SalaryRecordSerializer, SalarySettingsSerializer


class SalarySettingsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization'}, status=400)
        settings, _ = SalarySettings.objects.get_or_create(organization=org)
        return Response(SalarySettingsSerializer(settings).data)

    def create(self, request):
        org = request.user.organization
        if not org:
            return Response({'error': 'No organization'}, status=400)
        # Reading is fine for anyone in the org (employees see their pay in
        # this currency); changing pay rules is an admin decision.
        if not has_perm(request.user, 'hr.payroll'):
            return Response({'error': 'Your role doesn’t allow changing salary settings.'}, status=403)
        settings, _ = SalarySettings.objects.get_or_create(organization=org)
        serializer = SalarySettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class SalaryRecordViewSet(HRScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SalaryRecordSerializer
    hr_perm = 'hr.payroll'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Employees can read their own salary and payslips; everything else is staff-only.
        if self.action not in ('list', 'retrieve', 'payslip'):
            self.require_hr_perm()

    def get_queryset(self):
        return self.hr_queryset(SalaryRecord.objects.select_related('user').order_by('-month'))

    @action(detail=False, methods=['post'], url_path='process')
    def process_salary(self, request):
        """Auto-calculate salary from attendance for a user+month."""
        user_id = request.data.get('user_id')
        month = request.data.get('month')  # YYYY-MM
        if not user_id or not month:
            return Response({'error': 'user_id and month required'}, status=400)

        emp = self.hr_target_user(user_id)

        year, m = month.split('-')
        present_days = AttendanceRecord.objects.filter(
            user=emp, date__year=year, date__month=m, status='PRESENT'
        ).count()

        # Get daily rate: user override → org settings → default 500
        org = emp.organization
        daily_rate = emp.daily_rate
        if not daily_rate and org:
            settings = getattr(org, 'salary_settings', None)
            daily_rate = settings.default_daily_rate if settings else 500
        if not daily_rate:
            daily_rate = 500

        # Sum approved advances not yet deducted
        pending_advances = SalaryAdvance.objects.filter(
            user=emp, status='APPROVED', deducted_in__isnull=True
        )
        advance_total = sum(a.amount for a in pending_advances)

        record, _ = SalaryRecord.objects.update_or_create(
            user=emp, month=month,
            defaults={
                'days_present': present_days,
                'daily_rate': daily_rate,
                'advances_deducted': advance_total,
                'processed_by': request.user,
                'processed_at': timezone.now(),
            }
        )
        record.calculate()
        record.save()

        # Mark advances as deducted
        pending_advances.update(status='DEDUCTED', deducted_in=record)

        return Response(SalaryRecordSerializer(record).data)

    @action(detail=True, methods=['get'], url_path='payslip')
    def payslip(self, request, pk=None):
        """Generate a simple PDF payslip."""
        record = self.get_object()
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.pdfgen import canvas
            from reportlab.lib.units import cm
            import io as _io

            buf = _io.BytesIO()
            c = canvas.Canvas(buf, pagesize=A4)
            w, h = A4

            # Header
            c.setFillColorRGB(0.1, 0.7, 0.3)
            c.rect(0, h - 3 * cm, w, 3 * cm, fill=True, stroke=False)
            c.setFillColorRGB(1, 1, 1)
            c.setFont("Helvetica-Bold", 20)
            c.drawString(2 * cm, h - 2 * cm, "PAYSLIP")
            c.setFont("Helvetica", 11)
            c.drawString(2 * cm, h - 2.6 * cm, f"Month: {record.month}")

            # Employee details
            c.setFillColorRGB(0, 0, 0)
            c.setFont("Helvetica-Bold", 12)
            c.drawString(2 * cm, h - 4.5 * cm, "Employee Details")
            c.setFont("Helvetica", 10)
            details = [
                ("Name", record.user.get_full_name()),
                ("Email", record.user.email),
                ("Organization", record.user.organization_name or '—'),
                ("Employee ID", record.user.employee_id or str(record.user.id)),
            ]
            for i, (k, v) in enumerate(details):
                y = h - (5.5 + i * 0.7) * cm
                c.setFont("Helvetica-Bold", 10)
                c.drawString(2 * cm, y, f"{k}:")
                c.setFont("Helvetica", 10)
                c.drawString(7 * cm, y, str(v))

            # Salary breakdown
            c.setFont("Helvetica-Bold", 12)
            c.drawString(2 * cm, h - 9 * cm, "Salary Breakdown")

            # Table header
            c.setFillColorRGB(0.95, 0.95, 0.95)
            c.rect(1.5 * cm, h - 9.8 * cm, w - 3 * cm, 0.7 * cm, fill=True, stroke=False)
            c.setFillColorRGB(0, 0, 0)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(2 * cm, h - 9.5 * cm, "Description")
            c.drawString(13 * cm, h - 9.5 * cm, "Amount")

            rows = [
                ("Days Present", str(record.days_present)),
                ("Daily Rate", f"₹{record.daily_rate}"),
                ("Gross Salary", f"₹{record.gross_salary}"),
                ("Deductions", f"-₹{record.deductions}"),
                ("Advance Deducted", f"-₹{record.advances_deducted}"),
            ]
            c.setFont("Helvetica", 10)
            for i, (k, v) in enumerate(rows):
                y = h - (10.8 + i * 0.7) * cm
                c.drawString(2 * cm, y, k)
                c.drawString(13 * cm, y, v)

            # Net salary
            c.setFillColorRGB(0.1, 0.7, 0.3)
            c.rect(1.5 * cm, h - 15.5 * cm, w - 3 * cm, 0.8 * cm, fill=True, stroke=False)
            c.setFillColorRGB(1, 1, 1)
            c.setFont("Helvetica-Bold", 12)
            c.drawString(2 * cm, h - 15.2 * cm, "NET SALARY")
            c.drawString(13 * cm, h - 15.2 * cm, f"₹{record.net_salary}")

            c.setFillColorRGB(0.5, 0.5, 0.5)
            c.setFont("Helvetica", 8)
            c.drawString(2 * cm, 1.5 * cm, "This is a computer-generated payslip and does not require a signature.")
            c.save()
            buf.seek(0)

            response = HttpResponse(buf.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="payslip_{record.user.id}_{record.month}.pdf"'
            return response

        except ImportError:
            # Fallback plain text
            content = f"""
                PAYSLIP — {record.month}
                Employee: {record.user.get_full_name()}
                Email: {record.user.email}
                Organization: {record.user.organization_name or '—'}
                Days Present: {record.days_present}
                Daily Rate: ₹{record.daily_rate}
                Gross Salary: ₹{record.gross_salary}
                Deductions: -₹{record.deductions}
                Advance Deducted: -₹{record.advances_deducted}
                NET SALARY: ₹{record.net_salary}
                """
            response = HttpResponse(content, content_type='text/plain')
            response['Content-Disposition'] = f'attachment; filename="payslip_{record.month}.txt"'
            return response


class SalaryAdvanceViewSet(HRScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SalaryAdvanceSerializer
    hr_perm = 'hr.payroll'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.action in ('update', 'partial_update', 'destroy', 'approve', 'reject'):
            self.require_hr_perm()

    def get_queryset(self):
        return self.hr_queryset(SalaryAdvance.objects.select_related('user').order_by('-created_at'))

    def perform_create(self, serializer):
        serializer.save(user=self.hr_target_user(self.request.data.get('user_id')))

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        advance = self.get_object()
        advance.status = 'APPROVED'
        advance.approved_by = request.user
        advance.approved_at = timezone.now()
        advance.save()
        return Response(SalaryAdvanceSerializer(advance).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        advance = self.get_object()
        advance.status = 'REJECTED'
        advance.save()
        return Response(SalaryAdvanceSerializer(advance).data)
