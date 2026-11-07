"""Front-office endpoints for a property's staff: today's dashboard, the room
calendar, walk-in bookings, staff alerts and CSV exports. Everything is
scoped to the requesting user's own organization and checked against their
role's permissions (apps.core.access)."""
import csv
import datetime as dt
import uuid
from collections import defaultdict
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activity.utils import log_activity
from apps.core.access import has_perm
from apps.users.models import User

from . import notifications, services
from .models import Booking, Payment, Review, Room
from .serializers import BookingSerializer

ACTIVE = ('CONFIRMED', 'CHECKED_IN')
STAFF_ROLES = ('STP_ADMIN', 'STP_USER')


def _tz():
    return ZoneInfo(getattr(settings, 'PROPERTY_TIMEZONE', 'Asia/Kolkata'))


def _today():
    return dt.datetime.now(_tz()).date()


def _denied(request, perm):
    user = request.user
    if user.role not in STAFF_ROLES or not user.organization_id:
        return Response({'error': 'Staff only.'}, status=status.HTTP_403_FORBIDDEN)
    if not has_perm(user, perm):
        return Response({'error': 'Your role doesn’t allow this.'}, status=status.HTTP_403_FORBIDDEN)
    return None


def _rooms(org):
    return Room.objects.filter(organization=org, is_active=True).filter(Q(property__isnull=True) | Q(property__is_active=True))


def _guest(b):
    return b.guest_name or b.customer.get_full_name()


def _brief(b):
    return {
        'id': b.id, 'guest': _guest(b), 'phone': b.guest_phone, 'room': b.room.name,
        'property': b.property.name if b.property else '', 'check_in': b.check_in.isoformat(),
        'check_out': b.check_out.isoformat(), 'status': b.status, 'guests': b.guests,
        'balance_due': str(services.balance_due(b)), 'payment_method': b.payment_method,
    }


class DashboardView(APIView):
    """GET /api/bookings/dashboard/ - the hotel's day at a glance."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := _denied(request, 'bookings.view')):
            return resp
        org = request.user.organization
        tz, today = _tz(), _today()
        tomorrow = today + dt.timedelta(days=1)
        bookings = Booking.objects.filter(organization=org).select_related('room', 'property', 'customer').prefetch_related('payments')

        rooms_total = _rooms(org).count()
        occupied = (bookings.filter(status__in=ACTIVE, check_in__lte=today, check_out__gt=today)
                    .values('room_id').distinct().count())
        arrivals = list(bookings.filter(check_in=today, status__in=['PENDING', 'CONFIRMED']).order_by('room__name'))
        departures = list(bookings.filter(check_out=today, status__in=ACTIVE).order_by('room__name'))
        in_house = bookings.filter(status='CHECKED_IN').count()
        pending = bookings.filter(status='PENDING', payment_method='AT_PROPERTY').count()
        cancel_requests = bookings.filter(cancel_request_status='PENDING').count()
        owed = [b for b in bookings.filter(status__in=['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'], check_in__gte=today - dt.timedelta(days=60))
                if services.balance_due(b) > 0]

        start_today = dt.datetime.combine(today, dt.time.min, tzinfo=tz)
        month_start = dt.datetime.combine(today.replace(day=1), dt.time.min, tzinfo=tz)
        paid = Payment.objects.filter(booking__organization=org, status='PAID')
        revenue_today = paid.filter(paid_at__gte=start_today).aggregate(s=Sum('amount'))['s'] or Decimal('0')
        revenue_month = paid.filter(paid_at__gte=month_start).aggregate(s=Sum('amount'))['s'] or Decimal('0')

        # Last 30 days: bookings made and money received per day.
        since = today - dt.timedelta(days=29)
        made = defaultdict(int)
        for created in bookings.filter(created_at__gte=dt.datetime.combine(since, dt.time.min, tzinfo=tz)).values_list('created_at', flat=True):
            made[created.astimezone(tz).date()] += 1
        money = defaultdict(lambda: Decimal('0'))
        for paid_at, amount in paid.filter(paid_at__gte=dt.datetime.combine(since, dt.time.min, tzinfo=tz)).values_list('paid_at', 'amount'):
            money[paid_at.astimezone(tz).date()] += amount
        series = [{'date': (since + dt.timedelta(days=i)).isoformat(), 'bookings': made[since + dt.timedelta(days=i)],
                   'revenue': str(money[since + dt.timedelta(days=i)])} for i in range(30)]

        return Response({
            'date': today.isoformat(),
            'rooms_total': rooms_total, 'occupied_tonight': occupied,
            'occupancy': round(occupied * 100 / rooms_total) if rooms_total else 0,
            'arrivals': [_brief(b) for b in arrivals], 'departures': [_brief(b) for b in departures],
            'in_house': in_house, 'pending_confirmations': pending, 'cancel_requests': cancel_requests,
            'payments_due': {'count': len(owed), 'amount': str(sum((services.balance_due(b) for b in owed), Decimal('0')))},
            'revenue_today': str(revenue_today), 'revenue_month': str(revenue_month),
            'upcoming_7_days': bookings.filter(check_in__gte=tomorrow, check_in__lt=today + dt.timedelta(days=8),
                                               status__in=['PENDING', 'CONFIRMED']).count(),
            'series': series,
        })


class RoomCalendarView(APIView):
    """GET /api/bookings/calendar/?start=YYYY-MM-DD&days=14&property=ID -
    rooms and the bookings that occupy them in that range."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := _denied(request, 'bookings.view')):
            return resp
        org = request.user.organization
        start = parse_date(request.query_params.get('start') or '') or _today()
        days = min(max(int(request.query_params.get('days') or 14), 1), 42) if str(request.query_params.get('days', '14')).isdigit() else 14
        end = start + dt.timedelta(days=days)
        rooms = _rooms(org).select_related('property').order_by('property__name', 'name')
        prop = request.query_params.get('property')
        if prop and prop.isdigit():
            rooms = rooms.filter(property_id=prop)
        bookings = (Booking.objects.filter(organization=org, room__in=rooms, check_in__lt=end, check_out__gt=start)
                    .exclude(status='CANCELLED').select_related('room', 'property', 'customer').prefetch_related('payments'))
        return Response({
            'start': start.isoformat(), 'days': days,
            'rooms': [{'id': r.id, 'name': r.name, 'room_type': r.room_type, 'capacity': r.capacity,
                       'price_per_night': str(r.price_per_night), 'property': r.property.name if r.property else ''} for r in rooms],
            'bookings': [{**_brief(b), 'room_id': b.room_id, 'cancel_request': b.cancel_request_status == 'PENDING'} for b in bookings],
        })


def _walk_in_guest(name, phone, email):
    """The guest account a desk booking belongs to. With an email we reuse
    (or create) the guest's account - they can claim it later with "Forgot
    password". Without one, a hidden record that can't sign in."""
    first, _, last = name.strip().partition(' ')
    if email:
        user = User.objects.filter(email__iexact=email).first()
        if user and user.role != 'CUSTOMER':
            raise ValueError('That email belongs to a staff account - use the guest’s own email.')
        if user:
            return user
        user = User(username=email.lower(), email=email.lower(), first_name=first, last_name=last, phone=phone, role='CUSTOMER')
        user.set_unusable_password()
        user.save()
        return user
    placeholder = f'walkin-{uuid.uuid4().hex[:12]}@walkin.invalid'
    user = User(username=placeholder, email=placeholder, first_name=first, last_name=last, phone=phone,
                role='CUSTOMER', is_active=False)
    user.set_unusable_password()
    user.save()
    return user


class WalkInBookingView(APIView):
    """POST /api/bookings/walk_in/ - staff book a room for a guest at the
    desk or on the phone. Confirmed straight away; optional payment taken now.
    Body: room, check_in, check_out, guests, guest_name, guest_phone,
    guest_email?, special_requests?, check_in_now?, payment?: {method, amount}"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if (resp := _denied(request, 'bookings.manage')):
            return resp
        org = request.user.organization
        data = request.data
        errors = {}
        room = _rooms(org).filter(pk=data.get('room')).first() if str(data.get('room', '')).isdigit() else None
        if not room:
            errors['room'] = ['Choose a room.']
        check_in, check_out = parse_date(str(data.get('check_in') or '')), parse_date(str(data.get('check_out') or ''))
        today = _today()
        if not check_in or not check_out or check_out <= check_in:
            errors['check_out'] = ['Check-out must be after check-in.']
        elif check_in < today:
            errors['check_in'] = ['Check-in can’t be in the past.']
        name = (data.get('guest_name') or '').strip()
        phone = (data.get('guest_phone') or '').strip()
        email = (data.get('guest_email') or '').strip().lower()
        if len(name) < 2:
            errors['guest_name'] = ['Enter the guest’s name.']
        if len(phone) < 6:
            errors['guest_phone'] = ['Enter a phone number.']
        try:
            guests = int(data.get('guests') or 1)
        except (TypeError, ValueError):
            guests = 0
        if room and not 1 <= guests <= room.capacity:
            errors['guests'] = [f'This room sleeps up to {room.capacity}.']
        payment = data.get('payment') or None
        if payment and not has_perm(request.user, 'payments.collect'):
            errors['payment'] = ['Your role can’t take payments - save the booking and ask a cashier.']
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            Room.objects.select_for_update().get(pk=room.pk)
            if Booking.blocking_bookings(room, check_in, check_out).exists():
                return Response({'room': ['This room is already booked for some of these nights.']}, status=status.HTTP_400_BAD_REQUEST)
            try:
                guest = _walk_in_guest(name, phone, email)
            except ValueError as exc:
                return Response({'guest_email': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
            nights = (check_out - check_in).days
            booking = Booking.objects.create(
                organization=org, property=room.property, room=room, customer=guest,
                check_in=check_in, check_out=check_out, guests=guests,
                status='CHECKED_IN' if data.get('check_in_now') and check_in == today else 'CONFIRMED',
                payment_method='AT_PROPERTY', total_amount=room.price_per_night * nights,
                special_requests=(data.get('special_requests') or '')[:1000],
                guest_name=name, guest_email=email, guest_phone=phone,
            )
            if payment:
                try:
                    services.record_desk_payment(booking, payment.get('amount'), payment.get('method'), request.user, 'Walk-in')
                except ValueError as exc:
                    transaction.set_rollback(True)
                    return Response({'payment': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
        log_activity(request, 'CREATE', obj=booking, organization=org, changes={'source': [None, 'walk-in']})
        if email:
            notifications.notify(booking, 'confirmed')
        booking = Booking.objects.select_related('room', 'property', 'customer', 'organization').prefetch_related('payments').get(pk=booking.pk)
        return Response(BookingSerializer(booking, context={'request': request}).data, status=status.HTTP_201_CREATED)


class StaffNotificationsView(APIView):
    """GET /api/bookings/staff/notifications/ - what needs the desk's attention."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := _denied(request, 'bookings.view')):
            return resp
        org = request.user.organization
        now = timezone.now()
        week = now - dt.timedelta(days=7)
        items = []
        bookings = Booking.objects.filter(organization=org).select_related('room', 'customer')

        def add(key, kind, title, body, at, tone, link):
            items.append({'id': key, 'kind': kind, 'title': title, 'body': body, 'at': at.isoformat() if at else None, 'tone': tone, 'link': link})

        for b in bookings.filter(cancel_request_status='PENDING'):
            add(f'creq:{b.id}:{int(b.cancel_requested_at.timestamp()) if b.cancel_requested_at else 0}', 'cancel_request', f'{_guest(b)} asked to cancel',
                f'{b.room.name} · {b.check_in:%d %b} - “{b.cancel_request_reason[:80]}”', b.cancel_requested_at, 'danger', '/stp/bookings')
        for b in bookings.filter(status='PENDING', payment_method='AT_PROPERTY'):
            add(f'pend:{b.id}', 'pending', f'New request from {_guest(b)}', f'{b.room.name} · {b.check_in:%d %b} – {b.check_out:%d %b}',
                b.created_at, 'warning', '/stp/bookings')
        for b in bookings.filter(created_at__gte=week, status__in=['CONFIRMED', 'CHECKED_IN']):
            add(f'new:{b.id}', 'new_booking', f'New booking · {_guest(b)}', f'{b.room.name} · {b.check_in:%d %b} – {b.check_out:%d %b}',
                b.created_at, 'success', '/stp/bookings')
        if has_perm(request.user, 'payments.report') or has_perm(request.user, 'payments.collect'):
            for p in Payment.objects.filter(booking__organization=org, status='PAID', paid_at__gte=now - dt.timedelta(days=3)).select_related('booking__room', 'booking__customer'):
                add(f'pay:{p.id}', 'payment', f'Payment received · ₹{p.amount:,.0f}', f'{_guest(p.booking)} · {p.get_method_display()}',
                    p.paid_at, 'success', '/stp/collections')
        if has_perm(request.user, 'reviews.view'):
            for r in Review.objects.filter(organization=org, created_at__gte=week).select_related('booking'):
                add(f'rev:{r.id}', 'review', f'New {r.rating}★ review', (r.comment or 'No comment')[:90], r.created_at, 'info', '/stp/reviews')
        items.sort(key=lambda i: i['at'] or '', reverse=True)
        return Response(items[:40])


def _csv(filename, header, rows):
    resp = HttpResponse(content_type='text/csv; charset=utf-8')
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    resp.write('﻿')  # so Excel opens it as UTF-8 (₹, names)
    writer = csv.writer(resp)
    writer.writerow(header)
    writer.writerows(rows)
    return resp


def _range(request, default_days=30):
    end = parse_date(request.query_params.get('to') or '') or _today()
    start = parse_date(request.query_params.get('from') or '') or end - dt.timedelta(days=default_days)
    return start, end


class BookingsExportView(APIView):
    """GET /api/bookings/export/bookings.csv?from=&to= - bookings by check-in date."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := _denied(request, 'bookings.view')):
            return resp
        start, end = _range(request)
        qs = (Booking.objects.filter(organization=request.user.organization, check_in__gte=start, check_in__lte=end)
              .select_related('room', 'property', 'customer').prefetch_related('payments').order_by('check_in', 'id'))
        rows = [[f'CX-{b.id:06d}', _guest(b), b.guest_phone, b.guest_email if not b.guest_email.endswith('.invalid') else '',
                 b.property.name if b.property else '', b.room.name, b.check_in, b.check_out, (b.check_out - b.check_in).days,
                 b.guests, b.get_status_display(), b.get_payment_method_display(), b.total_amount,
                 services.amount_paid(b), services.balance_due(b), b.created_at.astimezone(_tz()).strftime('%Y-%m-%d %H:%M')]
                for b in qs]
        return _csv(f'bookings_{start}_{end}.csv',
                    ['Booking', 'Guest', 'Phone', 'Email', 'Property', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests',
                     'Status', 'Payment', 'Total', 'Paid', 'Balance', 'Booked at'], rows)


class CollectionsExportView(APIView):
    """GET /api/bookings/export/collections.csv?from=&to= - payments received."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := _denied(request, 'payments.report')):
            return resp
        tz = _tz()
        start, end = _range(request, 7)
        qs = (Payment.objects.filter(booking__organization=request.user.organization, status__in=['PAID', 'REFUNDED'],
                                     paid_at__gte=dt.datetime.combine(start, dt.time.min, tzinfo=tz),
                                     paid_at__lt=dt.datetime.combine(end + dt.timedelta(days=1), dt.time.min, tzinfo=tz))
              .select_related('booking__room', 'booking__customer', 'collected_by').order_by('paid_at'))
        rows = [[p.paid_at.astimezone(tz).strftime('%Y-%m-%d %H:%M'), f'CX-{p.booking_id:06d}', _guest(p.booking), p.booking.room.name,
                 p.get_method_display(), p.amount, 'Refunded' if p.status == 'REFUNDED' else 'Received',
                 p.collected_by.get_full_name() if p.collected_by else '', p.note] for p in qs]
        return _csv(f'collections_{start}_{end}.csv',
                    ['Time', 'Booking', 'Guest', 'Room', 'Method', 'Amount', 'Status', 'Collected by', 'Note'], rows)

