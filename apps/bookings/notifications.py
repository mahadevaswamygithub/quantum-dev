"""Emails about bookings, sent as the property (apps.core.email.send_org_email).

Queued after the database change commits, so a slow or broken mail server
never slows down or breaks a booking:
- BOOKING_EMAILS_VIA_CELERY=True (production): a Celery task with retries, so
  an email survives a web-server restart and a mail-server hiccup.
- otherwise, or if the broker is unreachable: a background thread.
Set BOOKING_EMAILS_ASYNC = False (tests do) to send inline.
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
    return None if not to or to.endswith('.invalid') else to  # deleted accounts, walk-ins without email


def _enabled(booking):
    from apps.tenants.models import OrgEmailSettings
    return OrgEmailSettings.for_org(booking.organization).send_booking_emails


PROPERTY_CANCEL_REQUEST = 'property_cancel_request'


def send_now(booking_id, kind):
    """Build and send one email. Raises on failure (so Celery can retry);
    a booking that no longer exists is silently skipped."""
    from .models import Booking
    if kind == PROPERTY_CANCEL_REQUEST:
        _send_cancel_request_to_property(booking_id)
        return
    booking = (Booking.objects.select_related('organization', 'organization__booking_settings', 'room', 'property', 'customer')
               .filter(pk=booking_id).first())
    if not booking or not _enabled(booking) or not _recipient(booking):
        return
    subject, body, attach_voucher = BUILDERS[kind](booking)
    attachments = []
    if attach_voucher:
        from .voucher import booking_reference, build_voucher_pdf
        attachments.append((f'booking-{booking_reference(booking)}.pdf', build_voucher_pdf(booking), 'application/pdf'))
    send_org_email(booking.organization, subject, body, _recipient(booking), attachments)


def _deliver(booking_id, kind):
    """Best effort: send and log (never raise)."""
    try:
        send_now(booking_id, kind)
    except Exception:
        logger.exception('Booking email %s for booking %s failed', kind, booking_id)


def _deliver_in_thread(booking_id, kind):
    # A new thread gets its own DB connection; close it when done.
    close_old_connections()
    try:
        _deliver(booking_id, kind)
    finally:
        close_old_connections()


def _dispatch(booking_id, kind):
    if not getattr(settings, 'BOOKING_EMAILS_ASYNC', True):
        _deliver(booking_id, kind)
        return

    def queue():
        if getattr(settings, 'BOOKING_EMAILS_VIA_CELERY', False):
            try:
                from .tasks import send_booking_email
                send_booking_email.delay(booking_id, kind)
                return
            except Exception:  # broker down: don't lose the email
                logger.warning('Celery unavailable - sending %s email for booking %s in-process', kind, booking_id)
        threading.Thread(target=_deliver_in_thread, args=(booking_id, kind), daemon=True).start()
    transaction.on_commit(queue)


def notify(booking, kind):
    """Queue a guest email ('requested', 'confirmed', 'cancelled', 'checked_out', 'cancel_requested', 'cancel_declined')."""
    _dispatch(booking.id, kind)


# ── message builders: (subject, body, attach PDF?) ────────────────────
def _requested(b):
    org = b.organization
    return (f'Booking request received - {org.name}',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Thanks for your booking request at {org.name}. They'll confirm it shortly and we'll email you when they do.\n\n"
            + _stay_lines(b) + _contact_lines(org), False)


def _confirmed(b):
    org = b.organization
    pay = ('Payment received - thank you.' if b.payment_method == 'ONLINE' or b.payments.filter(status='PAID').exists()
           else 'You can pay at the property when you arrive.')
    return (f'Your booking at {org.name} is confirmed (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Your stay at {org.name} is confirmed. Your confirmation is attached - please show it at check-in.\n\n"
            + _stay_lines(b) + f"\n{pay}\n" + _contact_lines(org), True)


def _cancelled(b):
    org = b.organization
    refunded = b.cancel_reason in ('REFUNDED', 'UNAVAILABLE') or b.payments.filter(status='REFUNDED').exists()
    note = 'Your payment has been refunded; it can take 5–7 working days to reach your account.' if refunded else ''
    approved = b.cancel_request_status == 'APPROVED'
    reply = f"\nMessage from {org.name}: {b.cancel_request_reply}\n" if approved and b.cancel_request_reply else ''
    return (f'Your booking at {org.name} was cancelled (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            + (f"{org.name} approved your cancellation request - your booking has been cancelled.\n"
               if approved else f"Your booking at {org.name} has been cancelled.\n")
            + reply + "\n" + _stay_lines(b) + (f"\n{note}\n" if note else '')
            + "\nIf this wasn't expected, please contact the property.\n" + _contact_lines(org), False)


def _cancel_requested(b):
    org = b.organization
    return (f'We received your cancellation request - {org.name} (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Your request to cancel your booking at {org.name} has been sent to the property. "
            "Your booking stays active until they reply - we'll email you as soon as they do.\n\n"
            + _stay_lines(b) + f"\nYour reason: {b.cancel_request_reason}\n" + _contact_lines(org), False)


def _cancel_declined(b):
    org = b.organization
    reply = f"\nMessage from {org.name}: {b.cancel_request_reply}\n" if b.cancel_request_reply else ''
    return (f'Your cancellation request was declined - {org.name} (CX-{b.id:06d})',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"{org.name} couldn't approve your cancellation request, so your booking is still active.\n"
            + reply + "\n" + _stay_lines(b) + _contact_lines(org), False)


def _checked_out(b):
    org = b.organization
    link = f"{settings.FRONTEND_URL}/book/me/trips"
    return (f'Thanks for staying at {org.name} - how was it?',
            f"Hello {b.guest_name or b.customer.first_name},\n\n"
            f"Thank you for staying at {org.name}. We'd love to hear how it went - it only takes a minute:\n{link}\n\n"
            "Your receipt is attached.\n" + _contact_lines(org), True)


BUILDERS = {
    'requested': _requested, 'confirmed': _confirmed, 'cancelled': _cancelled, 'checked_out': _checked_out,
    'cancel_requested': _cancel_requested, 'cancel_declined': _cancel_declined,
}


# ── to the property ───────────────────────────────────────────────────
def _send_cancel_request_to_property(booking_id):
    from .models import Booking
    b = (Booking.objects.select_related('organization', 'organization__booking_settings', 'room', 'property', 'customer')
         .filter(pk=booking_id).first())
    if not b or not b.organization.contact_email:
        return
    link = f"{settings.FRONTEND_URL}/stp/bookings"
    send_org_email(
        b.organization,
        f'Cancellation request from {b.guest_name or b.customer.get_full_name()} (CX-{b.id:06d})',
        "A guest has asked to cancel their booking after the free-cancellation window.\n\n"
        + _stay_lines(b)
        + f"Guest: {b.guest_name or b.customer.get_full_name()} · {b.guest_email or b.customer.email}"
        + (f" · {b.guest_phone}" if b.guest_phone else '') + "\n"
        + f"Reason: {b.cancel_request_reason}\n\nApprove or decline it in Bookings: {link}\n",
        b.organization.contact_email,
    )


def notify_property_of_cancel_request(booking):
    """Tell the property (its contact email, if set) that a guest asked to cancel."""
    _dispatch(booking.id, PROPERTY_CANCEL_REQUEST)
