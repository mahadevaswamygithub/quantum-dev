"""Emails to guests about their bookings, sent as the property (apps.core.email.send_org_email).

Sent after the database change commits, on a background thread, so a slow or
broken mail server never slows down or breaks a booking. Set
BOOKING_EMAILS_ASYNC = False (tests do) to send inline.
"""
import logging
import threading

from django.conf import settings
from django.db import close_old_connections, transaction

from apps.core.email import send_org_email

logger = logging.getLogger(__name__)


def _time(t):
    return t.strftime('%I:%M %p').lstrip('0') if t else ''


def _stay_lines(booking):
    rules = getattr(booking.organization, 'booking_settings', None)
    cin = booking.check_in.strftime('%a, %d %b %Y') + (f', from {_time(rules.check_in_time)}' if rules else '')
    cout = booking.check_out.strftime('%a, %d %b %Y') + (f', by {_time(rules.check_out_time)}' if rules else '')
    nights = (booking.check_out - booking.check_in).days
    return (
        f"Booking reference: CX-{booking.id:06d}\n"
        f"Room: {booking.room.name}" + (f" · {booking.property.name}" if booking.property else '') + "\n"
        f"Check-in:  {cin}\nCheck-out: {cout}\n"
        f"Nights: {nights} · Guests: {booking.guests}\n"
        f"Total: INR {booking.total_amount:,.2f}\n"
    )


def _contact_lines(org):
    bits = [x for x in (org.address, org.contact_phone, org.contact_email) if x]
    return ('\n' + org.name + '\n' + '\n'.join(bits) + '\n') if bits else f'\n{org.name}\n'


def _recipient(booking):
    to = booking.guest_email or booking.customer.email
    return None if not to or to.endswith('@deleted.invalid') else to


def _enabled(booking):
    from apps.tenants.models import OrgEmailSettings
    return OrgEmailSettings.for_org(booking.organization).send_booking_emails


def _deliver(booking_id, kind):
    from .models import Booking
    try:
        booking = (Booking.objects.select_related('organization', 'organization__booking_settings', 'room', 'property', 'customer')
                   .get(pk=booking_id))
        if not _enabled(booking) or not _recipient(booking):
            return
        subject, body, attach_voucher = BUILDERS[kind](booking)
        attachments = []
        if attach_voucher:
            from .voucher import booking_reference, build_voucher_pdf
            attachments.append((f'booking-{booking_reference(booking)}.pdf', build_voucher_pdf(booking), 'application/pdf'))
        send_org_email(booking.organization, subject, body, _recipient(booking), attachments)
    except Exception:
        logger.exception('Booking email %s for booking %s failed', kind, booking_id)


def _deliver_in_thread(booking_id, kind):
    # A new thread gets its own DB connection; close it when done.
    close_old_connections()
    try:
        _deliver(booking_id, kind)
    finally:
        close_old_connections()


def notify(booking, kind):
    """Queue a guest email ('requested', 'confirmed', 'cancelled', 'checked_out')."""
    if not getattr(settings, 'BOOKING_EMAILS_ASYNC', True):
        _deliver(booking.id, kind)
        return
    booking_id = booking.id
    transaction.on_commit(lambda: threading.Thread(target=_deliver_in_thread, args=(booking_id, kind), daemon=True).start())


# ── message builders: (subject, body, attach PDF?) ────────────────────
def _requested(b):
    org = b.organization
    return (f'Booking request received — {org.name}',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Thanks for your booking request at {org.name}. They'll confirm it shortly and we'll email you when they do.\n\n"
            + _stay_lines(b) + _contact_lines(org), False)


def _confirmed(b):
    org = b.organization
    pay = ('Payment received — thank you.' if b.payment_method == 'ONLINE' or b.payments.filter(status='PAID').exists()
           else 'You can pay at the property when you arrive.')
    return (f'Your booking at {org.name} is confirmed (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Your stay at {org.name} is confirmed. Your confirmation is attached — please show it at check-in.\n\n"
            + _stay_lines(b) + f"\n{pay}\n" + _contact_lines(org), True)


def _cancelled(b):
    org = b.organization
    refunded = b.cancel_reason in ('REFUNDED', 'UNAVAILABLE') or b.payments.filter(status='REFUNDED').exists()
    note = 'Your payment has been refunded; it can take 5–7 working days to reach your account.' if refunded else ''
    return (f'Your booking at {org.name} was cancelled (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Your booking at {org.name} has been cancelled.\n\n" + _stay_lines(b) + (f"\n{note}\n" if note else '')
            + "\nIf this wasn't expected, please contact the property.\n" + _contact_lines(org), False)


def _checked_out(b):
    org = b.organization
    link = f"{settings.FRONTEND_URL}/book/me/trips"
    return (f'Thanks for staying at {org.name} — how was it?',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Thank you for staying at {org.name}. We'd love to hear how it went — it only takes a minute:\n{link}\n\n"
            "Your receipt is attached.\n" + _contact_lines(org), True)


BUILDERS = {'requested': _requested, 'confirmed': _confirmed, 'cancelled': _cancelled, 'checked_out': _checked_out}
