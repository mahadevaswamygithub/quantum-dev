from celery import shared_task

from . import services


@shared_task
def expire_pending_bookings():
    """Cancel unpaid reservations whose payment window has passed.
    Scheduled by CELERY_BEAT_SCHEDULE in corex/settings.py."""
    return services.expire_stale_pending()
