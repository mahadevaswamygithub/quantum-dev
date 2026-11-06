"""Two-step verification (TOTP authenticator apps + one-time backup codes).

Login with 2FA is two calls:
  1. POST /auth/login/        email + password → {mfa_required, mfa_token}
                              (or {mfa_setup_required, mfa_token} for a role
                              that must use 2FA but hasn't set it up yet)
  2. POST /auth/2fa/verify/   mfa_token + code   → the usual tokens
The mfa_token is a signed, 5-minute, single-purpose ticket — it proves the
password was right, nothing more.
"""
import hashlib
import secrets
import time

import pyotp
from django.conf import settings
from django.core import signing
from django.utils import timezone

from apps.core.crypto import decrypt, encrypt

ISSUER = 'CoreX'
CHALLENGE_SALT = 'corex.mfa'
CHALLENGE_MAX_AGE = 300
BACKUP_CODE_COUNT = 10


def required_for(user):
    roles = getattr(settings, 'TWO_FACTOR_REQUIRED_ROLES', ['MSP_ADMIN'])
    return user.role in roles


def _record(user):
    from apps.users.models import UserTwoFactor
    return UserTwoFactor.objects.filter(user=user).first()


def is_enabled(user):
    rec = _record(user)
    return bool(rec and rec.enabled)


# ── login challenge tickets ───────────────────────────────────────────
def make_challenge(user, purpose):
    return signing.dumps({'u': user.pk, 'p': purpose, 'n': secrets.token_hex(4)}, salt=CHALLENGE_SALT)


def read_challenge(token, purpose):
    from apps.users.models import User
    try:
        data = signing.loads(token or '', salt=CHALLENGE_SALT, max_age=CHALLENGE_MAX_AGE)
    except signing.BadSignature:
        return None
    if data.get('p') != purpose:
        return None
    return User.objects.filter(pk=data.get('u'), is_active=True).first()


# ── setup / codes ─────────────────────────────────────────────────────
def start_setup(user):
    """New secret (not active until confirmed with a code). Returns (secret, otpauth URI)."""
    from apps.users.models import UserTwoFactor
    secret = pyotp.random_base32()
    rec, _ = UserTwoFactor.objects.get_or_create(user=user)
    if rec.enabled:
        raise ValueError('Two-step verification is already on.')
    rec.secret_encrypted = encrypt(secret)
    rec.save(update_fields=['secret_encrypted'])
    label = user.email
    return secret, pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=ISSUER)


def _hash(code):
    return hashlib.sha256(f'{settings.SECRET_KEY}:{code.replace("-", "").lower()}'.encode()).hexdigest()


def _new_backup_codes(rec):
    codes = [f'{secrets.token_hex(2)}-{secrets.token_hex(2)}' for _ in range(BACKUP_CODE_COUNT)]
    rec.backup_codes = [_hash(c) for c in codes]
    return codes


def _check_totp(rec, code):
    secret = decrypt(rec.secret_encrypted)
    if not secret:
        return False
    totp = pyotp.TOTP(secret)
    now = int(time.time())
    for offset in (-1, 0, 1):  # allow ±30 s clock drift
        step = now // 30 + offset
        if step <= (rec.last_used_step or 0):
            continue  # each code works once
        if secrets.compare_digest(totp.at(step * 30), code):
            rec.last_used_step = step
            rec.save(update_fields=['last_used_step'])
            return True
    return False


def verify(user, code):
    """True for a current authenticator code or an unused backup code (which is then used up)."""
    rec = _record(user)
    code = (code or '').strip().replace(' ', '')
    if not rec or not rec.secret_encrypted or not code:
        return False
    if code.isdigit() and len(code) == 6:
        return _check_totp(rec, code)
    h = _hash(code)
    if rec.enabled and h in (rec.backup_codes or []):
        rec.backup_codes = [c for c in rec.backup_codes if c != h]
        rec.save(update_fields=['backup_codes'])
        return True
    return False


def enable(user, code):
    """Confirm setup with a code from the app. Returns the backup codes (shown once)."""
    rec = _record(user)
    if not rec or rec.enabled or not rec.secret_encrypted:
        raise ValueError('Start setup first.')
    if not _check_totp(rec, (code or '').strip().replace(' ', '')):
        raise ValueError('That code didn’t match. Check the time on your phone and try the newest code.')
    codes = _new_backup_codes(rec)
    rec.enabled, rec.enabled_at = True, timezone.now()
    rec.save(update_fields=['backup_codes', 'enabled', 'enabled_at'])
    return codes


def regenerate_backup_codes(user):
    rec = _record(user)
    codes = _new_backup_codes(rec)
    rec.save(update_fields=['backup_codes'])
    return codes


def disable(user):
    from apps.users.models import UserTwoFactor
    UserTwoFactor.objects.filter(user=user).delete()


def status(user):
    rec = _record(user)
    return {
        'enabled': bool(rec and rec.enabled),
        'required': required_for(user),
        'backup_codes_left': len(rec.backup_codes or []) if rec and rec.enabled else 0,
        'enabled_at': rec.enabled_at if rec and rec.enabled else None,
    }
