"""Guest-only extras for the booking site: wishlist and notifications."""
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Booking, WishlistItem
from .public_stays import public_stays


class GuestOnly(IsAuthenticated):
    message = 'Log in with your guest account.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'CUSTOMER'


class WishlistView(APIView):
    """GET: saved properties (public details) · POST {organization}: save one."""
    permission_classes = [GuestOnly]

    def get(self, request):
        saved = list(WishlistItem.objects.filter(user=request.user).values_list('organization_id', 'created_at'))
        when = dict(saved)
        stays = [s for s in public_stays(request.build_absolute_uri) if s['id'] in when]
        stays.sort(key=lambda s: when[s['id']], reverse=True)
        return Response({'ids': [org_id for org_id, _ in saved], 'stays': stays})

    def post(self, request):
        org_id = request.data.get('organization')
        if not str(org_id).isdigit() or not any(s['id'] == int(org_id) for s in public_stays(request.build_absolute_uri)):
            return Response({'organization': ['This property isn’t available.']}, status=status.HTTP_400_BAD_REQUEST)
        WishlistItem.objects.get_or_create(user=request.user, organization_id=int(org_id))
        return Response({'saved': True}, status=status.HTTP_201_CREATED)


class WishlistItemView(APIView):
    """DELETE: remove a saved property."""
    permission_classes = [GuestOnly]

    def delete(self, request, org_id):
        WishlistItem.objects.filter(user=request.user, organization_id=org_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _when(dt):
    return dt.isoformat() if dt else None


class GuestNotificationsView(APIView):
    """Things a guest should know about their bookings, newest first.

    Derived from booking state (nothing extra stored): each item has a
    stable `id`, so the browser can remember which ones were seen."""
    permission_classes = [GuestOnly]

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()
        recent = now - timedelta(days=30)
        items = []
        bookings = (Booking.objects.filter(customer=request.user)
                    .filter(updated_at__gte=recent) | Booking.objects.filter(customer=request.user, check_out__gte=today))
        for b in bookings.select_related('organization', 'room').prefetch_related('payments').distinct():
            org = b.organization.name
            stay = f"{b.room.name} · {b.check_in:%d %b}"

            def add(kind, title, body, at, tone='info', link='/book/me/trips'):
                items.append({'id': f'{kind}:{b.id}:{b.status}:{b.cancel_request_status}', 'kind': kind, 'title': title,
                              'body': body, 'at': _when(at), 'tone': tone, 'link': link, 'booking': b.id})

            if b.cancel_request_status == 'DECLINED' and b.status in ('PENDING', 'CONFIRMED'):
                add('cancel_declined', f'{org} declined your cancellation request', b.cancel_request_reply or stay, b.updated_at, 'danger')
            if b.cancel_request_status == 'APPROVED' and b.status == 'CANCELLED':
                add('cancel_approved', f'{org} cancelled your booking as requested', b.cancel_request_reply or stay, b.updated_at, 'success')
            if b.cancel_request_status == 'PENDING':
                add('cancel_pending', 'Cancellation request sent', f'Waiting for {org} · {stay}', b.cancel_requested_at, 'warning', '/book/me/requests')
            if b.status == 'PENDING' and b.payment_method == 'AT_PROPERTY':
                add('awaiting', f'Waiting for {org} to confirm', stay, b.created_at, 'warning')
            elif b.status == 'CONFIRMED':
                add('confirmed', f'Your stay at {org} is confirmed', stay, b.updated_at, 'success')
                if services.can_pay_online(b):
                    add('payment_due', f'Payment due: ₹{services.balance_due(b):,.0f}', f'Pay online before you arrive · {org}', b.updated_at, 'warning')
                days = (b.check_in - today).days
                if 0 <= days <= 2:
                    add('check_in_soon', 'Check-in today' if days == 0 else f'Check-in in {days} day{"s" if days > 1 else ""}',
                        f'{org} · {stay}', now - timedelta(minutes=days), 'info')
            elif b.status == 'CANCELLED' and b.cancel_request_status != 'APPROVED' and b.cancelled_at and b.cancelled_at >= recent:
                add('cancelled', f'Booking at {org} cancelled', stay, b.cancelled_at, 'danger')
            elif b.status == 'CHECKED_OUT' and not hasattr(b, 'review') and b.updated_at >= recent:
                add('review', f'How was your stay at {org}?', 'Rate your stay - it takes a minute.', b.updated_at, 'info')
        items.sort(key=lambda i: i['at'] or '', reverse=True)
        return Response(items[:30])
