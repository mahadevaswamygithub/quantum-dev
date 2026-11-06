"""Per-account login lockout and session revocation.

After settings.LOGIN_MAX_FAILURES wrong passwords for one email (from any IP),
that email is locked for LOGIN_LOCKOUT_MINUTES. Counts live in the cache, so
use a shared cache (CACHE_USE_REDIS=True) when running several server processes.
Per-IP request limits are separate (DRF throttles, settings.DEFAULT_THROTTLE_RATES).
"""
import math
import time

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError


def _norm(email):
    return (email or '').strip().lower()


def _fail_key(email):
    return f'login-fail:{_norm(email)}'


def _lock_key(email):
    return f'login-lock:{_norm(email)}'


def _window():
    return getattr(settings, 'LOGIN_LOCKOUT_MINUTES', 15) * 60


def locked_minutes(email):
    """Minutes left on a lockout for this email, or 0."""
    until = cache.get(_lock_key(email))
    if not until:
        return 0
    return max(1, math.ceil((until - time.time()) / 60))


def record_failure(email):
    """Count a failed login; returns True if this attempt triggered a lockout."""
    window = _window()
    key = _fail_key(email)
    failures = (cache.get(key) or 0) + 1
    if failures >= getattr(settings, 'LOGIN_MAX_FAILURES', 5):
        cache.set(_lock_key(email), time.time() + window, window)
        cache.delete(key)
        return True
    cache.set(key, failures, window)
    return False


def clear_failures(email):
    cache.delete_many([_fail_key(email), _lock_key(email)])


def password_problems(password, user=None):
    """Django's password rules (length, too common, all numbers, too similar
    to the user's details) as a list of messages; empty if acceptable."""
    try:
        validate_password(password or '', user=user)
        return []
    except ValidationError as exc:
        return list(exc.messages)


def revoke_all_sessions(user):
    """Blacklist every refresh token issued to this user — signs them out on
    every device once their short-lived access token expires."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
