"""Customer accounts: creating them (self sign-up or by the platform owner),
changing their status, and the emails that go with it.

A *customer* is a top-level organization:
  - MSP  - a hotel group / management company; each hotel is a client
           STP organization under it, with its own manager.
  - STP  - a single business; its hotels are Properties inside it.

Status (Organization.status): PENDING (signed up, set-up only, hidden from
guests) → ACTIVE → SUSPENDED (no staff sign-in, hidden) / CLOSED.
"""
import re

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Domain, Organization

ADMIN_ROLE = {'MSP': 'MSP_ADMIN', 'STP': 'STP_ADMIN'}
_RESERVED_SCHEMAS = {'public', 'information_schema'}


def unique_schema_name(name):
    base = re.sub(r'_+', '_', re.sub(r'[^a-z0-9_]', '_', name.lower())).strip('_')[:40] or 'org'
    if base[0].isdigit() or base.startswith('pg_'):
        base = f'org_{base}'
    candidate, n = base, 1
    while candidate in _RESERVED_SCHEMAS or Organization.objects.filter(schema_name=candidate).exists():
        n += 1
        candidate = f'{base}{n}'
    return candidate


def unique_username(email):
    from apps.users.models import User
    base = re.sub(r'[^a-zA-Z0-9_.+-]', '', email.split('@')[0])[:30] or 'user'
    candidate, n = base, 1
    while User.objects.filter(username=candidate).exists():
        n += 1
        candidate = f'{base}{n}'
    return candidate


def create_organization(name, tenant_type, parent=None, org_type=None, **fields):
    """An Organization with its schema and Domain row."""
    if tenant_type == 'STP':
        org_type = org_type or 'ROOM_BOOKING'
    else:
        org_type = None
    schema_name = unique_schema_name(name)
    org = Organization.objects.create(schema_name=schema_name, name=name, tenant_type=tenant_type,
                                      org_type=org_type, parent_organization=parent, **fields)
    Domain.objects.create(domain=f'{schema_name}.localhost', tenant=org, is_primary=True)
    return org


def create_customer(*, account_type, name, first_name, last_name, email, phone='',
                    status='ACTIVE', signed_up=False, property_limit=None):
    """A new customer account and its admin. The admin gets an email link to set
    their password (which also proves they own the address)."""
    from apps.users.models import User
    if account_type not in ADMIN_ROLE:
        raise ValueError('account_type must be MSP or STP')
    with transaction.atomic():
        org = create_organization(name, account_type, status=status, signed_up=signed_up,
                                  property_limit=property_limit, status_changed_at=timezone.now())
        admin = User.objects.create_user(
            username=unique_username(email), email=email, first_name=first_name, last_name=last_name,
            password=None, organization=org, role=ADMIN_ROLE[account_type], phone=phone or None,
            is_auto_generated=True,
        )
        transaction.on_commit(lambda: send_welcome_email(admin))
        if signed_up:
            transaction.on_commit(lambda: _notify_platform_of_signup(org, admin))
    return org, admin


def set_password_link(user):
    """One-time link to choose a password (same token as "forgot password")."""
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.encoding import force_bytes
    from django.utils.http import urlsafe_base64_encode
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f'{settings.FRONTEND_URL}/reset-password/{uid}/{default_token_generator.make_token(user)}'


def _welcome_html(heading, paragraphs, button_label, link, steps, footer):
    """Simple, email-client-safe HTML (inline styles, one table, no images)."""
    from django.utils.html import escape
    paras = ''.join(f'<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6">{escape(p)}</p>'
                    for p in paragraphs)
    items = ''.join(f'<li style="margin:0 0 6px">{escape(s)}</li>' for s in steps)
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0f172a;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold">Core<span style="color:#22c55e">X</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;color:#0f172a;font-size:22px">{escape(heading)}</h1>
{paras}
<p style="margin:22px 0"><a href="{escape(link)}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">{escape(button_label)}</a></p>
<p style="margin:0 0 18px;color:#64748b;font-size:13px">If the button doesn't work, copy this link into your browser:<br><a href="{escape(link)}" style="color:#16a34a;word-break:break-all">{escape(link)}</a></p>
<p style="margin:0 0 6px;color:#0f172a;font-weight:bold;font-size:14px">Next steps</p>
<ol style="margin:0 0 18px;padding-left:20px;color:#334155;font-size:14px;line-height:1.6">{items}</ol>
<p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5">{escape(footer)}</p>
</td></tr></table></td></tr></table></body></html>"""


def send_welcome_email(user):
    """Welcome a new organization admin and ask them to set their password.
    Wording depends on the account: waiting for approval (self sign-up),
    ready to use (created by the platform owner), or a hotel added by a group.
    Returns True if sent (failures are logged by apps.core.email)."""
    from apps.core.email import send_email
    org = user.organization
    link = set_password_link(user)
    days = max(1, round(getattr(settings, 'PASSWORD_RESET_TIMEOUT', 259200) / 86400))
    login_url = f'{settings.FRONTEND_URL}/login'
    name = user.first_name or 'there'

    if org.parent_organization_id:
        heading = f'You manage {org.name} on CoreX'
        intro = [f'Hello {name},',
                 f'{org.parent_organization.name} added you as the admin of {org.name} on CoreX, '
                 'where you manage rooms, bookings, payments and guests.']
        steps = ['Set your password with the button above.', f'Sign in at {login_url} with {user.email}.',
                 'Add your rooms, photos and prices, then share your booking link with guests.']
    elif org.status == 'PENDING':
        heading = f'Welcome to CoreX, {name}'
        intro = [f'Thanks for signing up {org.name}.',
                 'Your account is created. Set your password to start setting up; '
                 'your hotels go live for guests once the CoreX team approves the account '
                 '(we will email you).']
        steps = ['Set your password with the button above.', f'Sign in at {login_url} with {user.email}.',
                 'Add your rooms, photos and prices.', 'We review your account and email you when it’s live.']
    else:
        heading = f'Welcome to CoreX, {name}'
        intro = [f'Your CoreX account for {org.name} is ready, and you are its admin.',
                 'Set your password to sign in.']
        steps = ['Set your password with the button above.', f'Sign in at {login_url} with {user.email}.',
                 ('Add your hotels and their managers.' if org.tenant_type == 'MSP'
                  else 'Add your rooms, photos and prices, then share your booking link with guests.')]

    footer = (f'This link works once and expires in {days} day{"s" if days != 1 else ""}. '
              f'After that, use "Forgot password" on {login_url}. '
              'If you weren’t expecting this email, you can ignore it.')
    text = '\n\n'.join(intro) + f'\n\nSet your password:\n{link}\n\nNext steps:\n' + \
        '\n'.join(f'{i}. {s}' for i, s in enumerate(steps, 1)) + f'\n\n{footer}\n'
    return send_email(f'Welcome to CoreX: set your password for {org.name}', text, user.email,
                      html=_welcome_html(heading, intro, 'Set your password', link, steps, footer))


def customer_admins(org):
    from apps.users.models import User
    return list(User.objects.filter(organization=org, role__in=ADMIN_ROLE.values(), is_active=True))


def platform_admin_emails():
    from apps.users.models import User
    return list(User.objects.filter(role='PLATFORM_ADMIN', is_active=True).values_list('email', flat=True))


def _notify_platform_of_signup(org, admin):
    from apps.core.email import send_email
    to = platform_admin_emails()
    if not to:
        return
    kind = 'hotel group (MSP)' if org.tenant_type == 'MSP' else 'business (STP)'
    send_email(
        f'New CoreX sign-up waiting for approval: {org.name}',
        f'{admin.get_full_name()} <{admin.email}> signed up a new {kind}: {org.name}.\n\n'
        f'Review it in the platform console: {settings.FRONTEND_URL}/platform\n',
        to,
    )


STATUS_EMAILS = {
    'ACTIVE': ('Your CoreX account is approved',
               'Good news: {name} is approved. Your hotels are now visible to guests and can take bookings.\n\n'
               'Sign in: {url}/login\n'),
    'SUSPENDED': ('Your CoreX account is suspended',
                  '{name} has been suspended, so staff can’t sign in and your hotels are hidden from guests. '
                  'Existing bookings are kept.\n{reason}\nPlease contact CoreX support to restore access.\n'),
    'CLOSED': ('Your CoreX account is closed',
               '{name} has been closed.\n{reason}\nContact CoreX support if you think this is a mistake.\n'),
}


def set_customer_status(org, new_status, reason='', request=None):
    """Approve / suspend / reactivate / close a customer account; emails its admins."""
    from apps.activity.utils import log_activity
    from apps.core.email import send_email
    if new_status not in dict(Organization.STATUS_CHOICES) or new_status == 'PENDING':
        raise ValueError('Invalid status')
    old = org.status
    if old == new_status:
        return org
    org.status = new_status
    org.status_reason = reason.strip()[:300]
    org.status_changed_at = timezone.now()
    org.save(update_fields=['status', 'status_reason', 'status_changed_at', 'updated_on'])
    if request is not None:
        log_activity(request, 'UPDATE', obj=org, organization=org, changes={'status': [old, new_status]})
    subject, body = STATUS_EMAILS[new_status]
    if new_status == 'ACTIVE' and old not in ('PENDING',):
        subject = 'Your CoreX account is active again'
    to = [u.email for u in customer_admins(org)]
    if to:
        transaction.on_commit(lambda: send_email(subject, body.format(
            name=org.name, url=settings.FRONTEND_URL,
            reason=f'Reason: {org.status_reason}\n' if org.status_reason else ''), to))
    return org
