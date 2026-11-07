"""Encrypting small secrets at rest (e.g. an organization's SMTP password).

Key: settings.FIELD_ENCRYPTION_KEY (a Fernet key) if set, otherwise derived
from SECRET_KEY - so set FIELD_ENCRYPTION_KEY explicitly in production if you
ever rotate SECRET_KEY, or stored secrets become unreadable (and must be re-entered).
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet():
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', '') or ''
    if not key:
        key = base64.urlsafe_b64encode(hashlib.sha256(f'corex-fields:{settings.SECRET_KEY}'.encode()).digest())
    return Fernet(key)


def encrypt(value):
    return _fernet().encrypt(value.encode()).decode() if value else ''


def decrypt(token):
    if not token:
        return ''
    try:
        return _fernet().decrypt(token.encode()).decode()
    except (InvalidToken, ValueError):
        return ''
