"""
Thin wrapper around the razorpay SDK client - one place that reads
settings, so views never touch settings.RAZORPAY_* directly and every
call site gets the same "not configured" behavior for free.
"""
from django.conf import settings
import razorpay


def get_client():
    """Returns a configured razorpay.Client, or None if keys aren't set
    (blank by default - see corex/settings.py). Callers should turn a None
    into a 503, not let requests hit razorpay with empty credentials."""
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        return None
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
