"""
Booking/payment state changes that more than one entry point needs:
the customer's browser callback (verify_payment), Razorpay's server-to-server
webhook, staff refunds, and the periodic expiry of unpaid reservations.

Keeping them here means a payment is confirmed by exactly the same rules no
matter which of those arrives first (and the second one is a harmless no-op).
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Booking, Payment, Room
from .razorpay_client import get_client

logger = logging.getLogger(__name__)


def payment_window():
    """How long an unpaid (PENDING) reservation holds its room."""
    return timedelta(minutes=getattr(settings, 'BOOKING_PAYMENT_WINDOW_MINUTES', 15))


def pending_cutoff():
    """PENDING reservations created before this moment no longer hold a room."""
    return timezone.now() - payment_window()


def is_stale_pending(booking):
    return (booking.status == 'PENDING' and booking.payment_method == 'ONLINE'
            and booking.created_at < pending_cutoff())


def expire_stale_pending(queryset=None):
    """Cancel PENDING reservations whose payment window has passed. Returns
    how many were expired. Safe to call often: it's one UPDATE.

    Room availability already ignores stale PENDING rows (see
    Booking.room_is_available), so correctness never depends on this having
    run — it just keeps lists and statuses honest."""
    qs = queryset if queryset is not None else Booking.objects.all()
    now = timezone.now()
    return qs.filter(status='PENDING', payment_method='ONLINE', created_at__lt=pending_cutoff()).update(
        status='CANCELLED', cancel_reason='EXPIRED', cancelled_at=now, updated_at=now,
    )


def amount_paid(booking):
    from decimal import Decimal
    return sum((p.amount for p in booking.payments.all() if p.status == 'PAID'), Decimal('0'))


def balance_due(booking):
    from decimal import Decimal
    return max(booking.total_amount - amount_paid(booking), Decimal('0'))


DESK_METHODS = ('CASH', 'UPI', 'CARD', 'OTHER')


def record_desk_payment(booking, amount, method, staff, note=''):
    """Money taken at the desk. Partial payments are fine; it can't exceed what's owed."""
    from decimal import Decimal, InvalidOperation
    if method not in DESK_METHODS:
        raise ValueError('Choose cash, UPI, card or other.')
    if booking.status not in ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'):
        raise ValueError(f'Cannot take payment for a {booking.get_status_display().lower()} booking.')
    due = balance_due(booking)
    if due <= 0:
        raise ValueError('This booking is already fully paid.')
    try:
        amount = Decimal(str(amount)) if amount not in (None, '') else due
    except InvalidOperation:
        raise ValueError('Enter a valid amount.')
    if amount <= 0:
        raise ValueError('Amount must be more than zero.')
    if amount > due:
        raise ValueError(f'Only ₹{due} is still owed on this booking.')
    return Payment.objects.create(
        booking=booking, amount=amount, status='PAID', method=method, collected_by=staff,
        note=(note or '')[:200], paid_at=timezone.now(),
    )


def can_pay_online(booking):
    """A booking can be paid online when the gateway is set up, it isn't
    paid yet, and it's either a fresh pay-now reservation or one the
    property has already confirmed (pay-later / approved bookings). A
    pay-later booking still awaiting approval can't be paid yet."""
    if get_client() is None:
        return False
    if balance_due(booking) <= 0:
        return False
    if booking.status == 'CONFIRMED':
        return True
    return booking.status == 'PENDING' and booking.payment_method == 'ONLINE' and not is_stale_pending(booking)


def _rules_for(booking):
    from .models import BookingSettings
    return getattr(booking.organization, 'booking_settings', None) or BookingSettings(organization=booking.organization)


def check_in_at(booking):
    """Aware datetime of check-in (check-in date + the property's check-in time, property local time)."""
    import datetime as dt
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(getattr(settings, 'PROPERTY_TIMEZONE', 'Asia/Kolkata'))
    return dt.datetime.combine(booking.check_in, _rules_for(booking).check_in_time, tzinfo=tz)


def cancellation_deadline(booking):
    """Last moment a guest may cancel a confirmed booking online."""
    return check_in_at(booking) - timedelta(hours=_rules_for(booking).free_cancellation_hours)


def guest_can_cancel(booking, now=None):
    """Not yet confirmed (awaiting approval / unpaid): the guest may withdraw
    until check-in. Confirmed: only until the free-cancellation deadline;
    after that they must contact the property (staff can still cancel)."""
    now = now or timezone.now()
    if booking.status == 'PENDING':
        return now < check_in_at(booking)
    if booking.status == 'CONFIRMED':
        return now < cancellation_deadline(booking)
    return False


class RefundFailed(Exception):
    pass


def refund_payment(payment):
    """Refund a PAID payment in full through Razorpay and mark it REFUNDED.
    Raises RefundFailed (payment left PAID) if the gateway call fails."""
    if payment.method != 'ONLINE':
        # Cash/UPI/card taken at the desk: the money is handed back in person.
        payment.status = 'REFUNDED'
        payment.save(update_fields=['status', 'updated_at'])
        return
    client = get_client()
    if client is None:
        raise RefundFailed('Payment gateway is not configured.')
    try:
        client.payment.refund(payment.razorpay_payment_id, {'amount': int(payment.amount * 100)})
    except Exception as exc:  # razorpay errors, network errors
        logger.exception('Razorpay refund failed for payment %s', payment.pk)
        raise RefundFailed(f'Refund failed at the payment gateway: {exc}') from exc
    payment.status = 'REFUNDED'
    payment.save(update_fields=['status', 'updated_at'])


# Outcomes of confirm_payment()
CONFIRMED = 'confirmed'            # booking is now (or already was) confirmed by this payment
ALREADY_PROCESSED = 'already_processed'
REFUNDED = 'refunded'              # paid, but the booking couldn't be honoured → money returned
NEEDS_MANUAL_REFUND = 'needs_manual_refund'  # as above, but the automatic refund failed


def confirm_payment(payment, razorpay_payment_id, signature=''):
    """Record a successful Razorpay payment and confirm its booking — but
    only if the booking can still be honoured.

    Called after the signature has been verified. Idempotent: the browser
    callback and the webhook may both arrive, in either order.

    Returns (booking, outcome)."""
    with transaction.atomic():
        payment = Payment.objects.select_for_update().get(pk=payment.pk)
        booking = Booking.objects.select_for_update().get(pk=payment.booking_id)

        if payment.status in ('PAID', 'REFUNDED'):
            return booking, ALREADY_PROCESSED

        payment.status = 'PAID'
        payment.method = 'ONLINE'
        payment.paid_at = timezone.now()
        payment.razorpay_payment_id = razorpay_payment_id or payment.razorpay_payment_id
        if signature:
            payment.razorpay_signature = signature
        payment.save()

        from django.db.models import Sum
        paid_by_others = booking.payments.filter(status='PAID').exclude(pk=payment.pk).aggregate(s=Sum('amount'))['s'] or 0
        other_paid = paid_by_others >= booking.total_amount
        if other_paid:
            pass  # booking was already fully paid (duplicate payment) → refund below
        elif booking.status in ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'):
            # e.g. staff confirmed it at the desk before the online payment
            # landed — the booking stands, this payment simply settles it.
            return booking, CONFIRMED
        elif booking.status == 'PENDING' or booking.cancel_reason == 'EXPIRED':
            # Lock the room so a concurrent booking can't take it between
            # the availability check and the status change. A booking that
            # expired while the customer was paying is revived only if the
            # room is still free.
            Room.objects.select_for_update().get(pk=booking.room_id)
            if Booking.room_is_available(booking.room, booking.check_in, booking.check_out, exclude_booking_id=booking.id):
                booking.status = 'CONFIRMED'
                booking.cancelled_at = None
                booking.cancel_reason = ''
                booking.save(update_fields=['status', 'cancelled_at', 'cancel_reason', 'updated_at'])
                return booking, CONFIRMED
            booking.status = 'CANCELLED'
            booking.cancel_reason = 'UNAVAILABLE'
            booking.cancelled_at = booking.cancelled_at or timezone.now()
            booking.save(update_fields=['status', 'cancel_reason', 'cancelled_at', 'updated_at'])
        # else: cancelled by the customer/staff before the payment landed.

    # The money was taken but the booking can't be honoured (room re-let,
    # booking cancelled, or this is a duplicate payment) → give it back.
    try:
        refund_payment(payment)
        return booking, REFUNDED
    except RefundFailed:
        return booking, NEEDS_MANUAL_REFUND
