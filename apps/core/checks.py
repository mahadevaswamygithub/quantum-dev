"""Production-readiness checks — run with `python manage.py check --deploy`.

They don't stop local development; they flag settings that are unsafe once
CoreX runs on more than one server or with real customers.
"""
from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security, deploy=True)
def production_readiness(app_configs, **kwargs):
    issues = []
    if 'redis' not in settings.CACHES['default']['BACKEND'].lower():
        issues.append(Warning(
            'The cache is per-process memory, so login lockouts and rate limits are not shared between servers.',
            hint='Set CACHE_USE_REDIS=True (and REDIS_URL) in production.', id='corex.W001'))
    if not getattr(settings, 'USE_S3', False):
        issues.append(Warning(
            'Uploads are stored on this server’s local disk; other servers won’t see them and they are lost with the disk.',
            hint='Set USE_S3=True with S3_BUCKET (AWS S3, Cloudflare R2, MinIO, Wasabi…).', id='corex.W002'))
    if not getattr(settings, 'BOOKING_EMAILS_VIA_CELERY', False):
        issues.append(Warning(
            'Booking emails are sent from web-server threads with no retries.',
            hint='Run a Celery worker and set BOOKING_EMAILS_VIA_CELERY=True.', id='corex.W003'))
    if not getattr(settings, 'SENTRY_DSN', ''):
        issues.append(Warning(
            'No error tracking is configured.', hint='Set SENTRY_DSN to receive errors with request IDs.', id='corex.W004'))
    return issues
