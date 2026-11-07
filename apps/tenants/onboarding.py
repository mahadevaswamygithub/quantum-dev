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
    from apps.users.serializers.users import send_invite_email
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
        transaction.on_commit(lambda: send_invite_email(admin))
        if signed_up:
            transaction.on_commit(lambda: _notify_platform_of_signup(org, admin))
    return org, admin


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
