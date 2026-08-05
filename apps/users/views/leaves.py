"""Leave type, leave request, and leave balance viewsets."""
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import AttendanceRecord, LeaveBalance, LeaveRequest, LeaveType, User
from ..serializers import LeaveBalanceSerializer, LeaveRequestSerializer, LeaveTypeSerializer


class LeaveTypeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveTypeSerializer
    queryset = LeaveType.objects.filter(is_active=True)


class LeaveRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveRequestSerializer

    def get_queryset(self):
        qs = LeaveRequest.objects.select_related('user').order_by('-created_at')
        req = self.request
        user_id = req.query_params.get('user_id')

        if req.user.role == 'EMPLOYEE':
            return qs.filter(user=req.user)
        if user_id:
            return qs.filter(user_id=user_id)
        return qs

    def perform_create(self, serializer):
        user_id = self.request.data.get('user_id') or self.request.user.id
        user = User.objects.get(id=user_id)
        serializer.save(user=user)

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
        from datetime import date, timedelta
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
        if leave.user != request.user and request.user.role not in ('MSP_ADMIN', 'STP_ADMIN'):
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


class LeaveBalanceViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = LeaveBalanceSerializer

    def get_queryset(self):
        qs = LeaveBalance.objects.all()
        user_id = self.request.query_params.get('user_id')
        if self.request.user.role == 'EMPLOYEE':
            return qs.filter(user=self.request.user)
        if user_id:
            return qs.filter(user_id=user_id)
        return qs
