"""Leave type, leave request, and leave balance viewsets."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.core.access import HRScopedMixin, has_perm
from ..models import AttendanceRecord, LeaveBalance, LeaveRequest, LeaveType
from ..serializers import LeaveBalanceSerializer, LeaveRequestSerializer, LeaveTypeSerializer


class LeaveTypeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveTypeSerializer
    queryset = LeaveType.objects.filter(is_active=True)


class LeaveRequestViewSet(HRScopedMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer
    hr_perm = 'hr.leaves'

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        # Editing/deleting a request directly is staff-only; employees use
        # create and cancel.
        if self.action in ('update', 'partial_update', 'destroy', 'approve', 'reject'):
            self.require_hr_perm()

    def get_queryset(self):
        return self.hr_queryset(LeaveRequest.objects.select_related('user').order_by('-created_at'))

    def perform_create(self, serializer):
        serializer.save(user=self.hr_target_user(self.request.data.get('user_id')))

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'PENDING':
            return Response({'error': 'Leave is not pending'}, status=400)
        leave.status = 'APPROVED'
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.save()

        # Auto-mark attendance as LEAVE for each day in range
        from datetime import timedelta
        current = leave.from_date
        while current <= leave.to_date:
            AttendanceRecord.objects.update_or_create(
                user=leave.user, date=current,
                defaults={'status': 'LEAVE', 'marked_by': request.user}
            )
            current += timedelta(days=1)

        # Update leave balance
        self._update_balance(leave.user, leave.leave_type, leave.days, add=True)
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        leave = self.get_object()
        if leave.status != 'PENDING':
            return Response({'error': 'Leave is not pending'}, status=400)
        leave.status = 'REJECTED'
        leave.rejection_reason = request.data.get('reason', '')
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        leave = self.get_object()
        if leave.user != request.user and not has_perm(request.user, 'hr.leaves'):
            return Response({'error': 'Not authorized'}, status=403)
        if leave.status == 'APPROVED':
            self._update_balance(leave.user, leave.leave_type, leave.days, add=False)
        leave.status = 'CANCELLED'
        leave.save()
        return Response(LeaveRequestSerializer(leave).data)

    def _update_balance(self, user, leave_type, days, add=True):
        year = timezone.now().year
        balance, _ = LeaveBalance.objects.get_or_create(
            user=user, leave_type=leave_type, year=year,
            defaults={'allocated': 12, 'used': 0, 'remaining': 12}
        )
        if add:
            balance.used += days
            balance.remaining = max(balance.allocated - balance.used, 0)
        else:
            balance.used = max(balance.used - days, 0)
            balance.remaining = balance.allocated - balance.used
        balance.save()


class LeaveBalanceViewSet(HRScopedMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveBalanceSerializer
    hr_perm = 'hr.leaves'

    def get_queryset(self):
        return self.hr_queryset(LeaveBalance.objects.all())
