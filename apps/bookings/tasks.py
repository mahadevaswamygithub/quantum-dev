from celery import shared_task

from . import services


@shared_task
def expire_pending_bookings():
    """Cancel unpaid reservations whose payment window has passed.
    Scheduled by CELERY_BEAT_SCHEDULE in corex/settings.py."""
    return services.expire_stale_pending()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=30, retry_backoff_max=1800, retry_jitter=True,
             max_retries=6, acks_late=True)
def send_booking_email(self, booking_id, kind):
    """Send one booking email; retried with backoff (30s → 30min, 6 tries)
    if the mail server fails. Queued by notifications.notify()."""
    from .notifications import send_now
    send_now(booking_id, kind)
