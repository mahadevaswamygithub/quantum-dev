"""Sending email without hiding failures.

Callers that must not reveal whether an address exists (forgot password) or
must not roll back work if the mail server hiccups (invites) still shouldn't
swallow errors silently - that hid a broken SMTP login for weeks. These log
the failure with a stack trace and return False instead of raising.
"""
import logging
from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMessage, get_connection, send_mail

logger = logging.getLogger(__name__)


def send_email(subject, body, to, html=None):
    """Send an email from the platform address: plain text, plus an HTML version
    when `html` is given. True on success; logs and returns False on failure."""
    recipients = [to] if isinstance(to, str) else list(to)
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=False, html_message=html)
        return True
    except Exception:  # SMTP auth/connection errors, bad config, etc.
        logger.exception('Failed to send email %r to %s', subject, ', '.join(recipients))
        return False


def _platform_address(org, cfg):
    return formataddr((cfg.from_name or org.name, settings.DEFAULT_FROM_EMAIL))


def _custom_connection(cfg):
    from apps.core.crypto import decrypt
    return get_connection(
        'django.core.mail.backends.smtp.EmailBackend',
        host=cfg.smtp_host, port=cfg.smtp_port, username=cfg.smtp_username, password=decrypt(cfg.smtp_password_encrypted),
        use_tls=cfg.smtp_security == 'TLS', use_ssl=cfg.smtp_security == 'SSL', timeout=20, fail_silently=False,
    )


def build_org_message(org, subject, body, to, attachments=(), use_custom=True):
    """An EmailMessage sent *as* the organization: its own account (CUSTOM mode)
    or CoreX's account with the organization's name and Reply-To (default)."""
    from apps.tenants.models import OrgEmailSettings
    cfg = OrgEmailSettings.for_org(org)
    reply_to = [cfg.reply_to or org.contact_email] if (cfg.reply_to or org.contact_email) else None
    if use_custom and cfg.custom_ready:
        sender = formataddr((cfg.from_name or org.name, cfg.from_email or cfg.smtp_username))
        connection = _custom_connection(cfg)
    else:
        sender = _platform_address(org, cfg)
        connection = None  # default (platform) backend
    msg = EmailMessage(subject, body, sender, [to], reply_to=reply_to, connection=connection)
    for name, content, mimetype in attachments:
        msg.attach(name, content, mimetype)
    return msg


def send_org_email(org, subject, body, to, attachments=()):
    """Send as the organization. If its own mail server fails, fall back to the
    platform account so the guest still gets the email. Returns True if sent."""
    try:
        build_org_message(org, subject, body, to, attachments).send()
        return True
    except Exception:
        logger.exception('Org %s: sending %r to %s failed; retrying via the platform account', org.pk, subject, to)
    try:
        build_org_message(org, subject, body, to, attachments, use_custom=False).send()
        return True
    except Exception:
        logger.exception('Org %s: sending %r to %s failed on the platform account too', org.pk, subject, to)
        return False
