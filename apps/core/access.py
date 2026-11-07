"""
Staff access control: the permission catalog, preset roles, and the one
`has_perm()` check everything else uses.

Tiers (User.role) stay as they are:
  - MSP_ADMIN / STP_ADMIN  → every permission of their portal, always.
  - MSP_USER  / STP_USER   → exactly the permissions of their OrgRole
                             (User.access_role); none if they have no role.
  - EMPLOYEE / CUSTOMER    → not covered here (they have their own portals).

Each organization owns its roles (apps.users.models.OrgRole), seeded from
PRESETS when the org is created; its admins can edit them or add more.
"""

# (code, label) grouped into the sections shown in Settings → Roles & access.
# `portal` says which kind of organization the section applies to.
CATALOG = [
    {
        'key': 'bookings', 'label': 'Room booking', 'portal': 'STP', 'room_booking': True,
        'perms': [
            ('bookings.view', 'View bookings'),
            ('bookings.manage', 'Confirm, check in/out and cancel bookings'),
            ('payments.refund', 'Refund payments'),
            ('payments.collect', 'Record payments at the desk (cash, UPI, card)'),
            ('payments.report', 'View daily collection'),
            ('guests.view', 'View guests'),
            ('reviews.view', 'View guest reviews and private feedback'),
            ('reviews.reply', 'Reply to reviews'),
            ('rooms.view', 'View properties & rooms'),
            ('rooms.manage', 'Add and edit properties & rooms'),
        ],
    },
    {
        'key': 'organizations', 'label': 'Organizations', 'portal': 'MSP',
        'perms': [
            ('organizations.view', 'View organizations'),
            ('organizations.manage', 'Create, edit and activate organizations'),
            ('organizations.impersonate', 'Log in as an organization (impersonate)'),
            ('platform.view', 'View platform status'),
        ],
    },
    {
        'key': 'team', 'label': 'Team & administration', 'portal': 'ANY',
        'perms': [
            ('users.view', 'View users'),
            ('users.manage', 'Add, edit and deactivate users'),
            ('activity.view', 'View activity log'),
            ('settings.manage', 'Change organization settings'),
        ],
    },
    {
        'key': 'hr', 'label': 'Employees (HR)', 'portal': 'ANY',
        'perms': [
            ('hr.attendance', 'View and mark attendance'),
            ('hr.leaves', 'Approve or reject leave'),
            ('hr.payroll', 'View and process salaries'),
        ],
    },
]

ALL_CODES = {code for section in CATALOG for code, _ in section['perms']}


def catalog_for(org):
    """Sections that apply to this organization (MSP vs STP, room booking or not)."""
    out = []
    for section in CATALOG:
        if section['portal'] not in ('ANY', org.tenant_type):
            continue
        if section.get('room_booking') and org.org_type != 'ROOM_BOOKING':
            continue
        out.append(section)
    return out


def codes_for(org):
    return {code for section in catalog_for(org) for code, _ in section['perms']}


PRESETS = {
    'STP': [
        ('Manager', 'Runs day-to-day operations; everything except settings and roles.', [
            'bookings.view', 'bookings.manage', 'payments.refund', 'payments.collect', 'payments.report',
            'guests.view', 'reviews.view', 'reviews.reply', 'rooms.view', 'rooms.manage',
            'users.view', 'users.manage', 'activity.view', 'hr.attendance', 'hr.leaves', 'hr.payroll',
        ]),
        ('Front desk', 'Handles arrivals, departures and guest requests.', [
            'bookings.view', 'bookings.manage', 'payments.collect', 'guests.view', 'reviews.view', 'rooms.view',
        ]),
        ('Cashier', 'Takes payments, issues refunds and closes the day.', [
            'bookings.view', 'payments.collect', 'payments.refund', 'payments.report', 'guests.view',
        ]),
        ('Viewer', 'Read-only access.', [
            'bookings.view', 'guests.view', 'reviews.view', 'rooms.view', 'users.view',
        ]),
    ],
    'MSP': [
        ('Account manager', 'Manages client organizations.', [
            'organizations.view', 'organizations.manage', 'organizations.impersonate', 'users.view', 'users.manage',
            'activity.view', 'platform.view',
        ]),
        ('Support', 'Helps client organizations; can log in as them.', [
            'organizations.view', 'organizations.impersonate', 'users.view',
        ]),
        ('Viewer', 'Read-only access.', [
            'organizations.view', 'users.view', 'platform.view',
        ]),
    ],
}

# Existing *_USER staff are moved onto this preset so nobody loses access.
DEFAULT_PRESET = {'STP': 'Manager', 'MSP': 'Account manager'}

ADMIN_TIERS = ('MSP_ADMIN', 'STP_ADMIN')
USER_TIERS = ('MSP_USER', 'STP_USER')


# Permissions added to existing preset roles when they were introduced
# (see the bookings migration that adds desk payments and reviews).
PRESET_ADDITIONS = {
    'Manager': ['payments.collect', 'payments.report', 'reviews.view', 'reviews.reply'],
    'Front desk': ['payments.collect', 'reviews.view'],
    'Cashier': ['payments.collect', 'payments.report'],
    'Viewer': ['reviews.view'],
}


def seed_roles(org, role_model=None):
    """Create the preset roles for an organization (idempotent)."""
    if role_model is None:
        from apps.users.models import OrgRole as role_model
    allowed = codes_for(org)
    for name, description, perms in PRESETS.get(org.tenant_type, []):
        role_model.objects.get_or_create(
            organization=org, name=name,
            defaults={'description': description, 'permissions': [p for p in perms if p in allowed], 'is_preset': True},
        )


def user_permissions(user):
    """The set of permission codes this staff user has."""
    if not getattr(user, 'is_authenticated', False):
        return set()
    org = getattr(user, 'organization', None)
    if user.role in ADMIN_TIERS:
        return codes_for(org) if org else set()
    if user.role in USER_TIERS:
        role = getattr(user, 'access_role', None)
        if not role or not org:
            return set()
        return set(role.permissions or []) & codes_for(org)
    return set()


def has_perm(user, code):
    return code in user_permissions(user)


class HasPerm:
    """DRF permission: `permission_classes = [IsAuthenticated, HasPerm.of('bookings.view')]`."""

    @staticmethod
    def of(code):
        from rest_framework.permissions import BasePermission

        class _HasPerm(BasePermission):
            message = 'Your role doesn’t allow this.'

            def has_permission(self, request, view):
                return has_perm(request.user, code)

        _HasPerm.__name__ = f'HasPerm[{code}]'
        return _HasPerm


class HRScopedMixin:
    """Attendance / leave / payroll viewsets.

    - EMPLOYEE: only their own records.
    - MSP/STP staff with `hr_perm`: employees of the organizations they can
      see (their own org; for MSP also its client orgs).
    - Everyone else (incl. guests): nothing.
    """
    hr_perm = None

    def _visible_org_ids(self):
        from apps.core.permissions import get_visible_organization_ids
        return get_visible_organization_ids(self.request.user, include_own_org=True) or []

    def hr_queryset(self, qs):
        user = self.request.user
        if user.role == 'EMPLOYEE':
            return qs.filter(user=user)
        if not has_perm(user, self.hr_perm):
            return qs.none()
        qs = qs.filter(user__organization_id__in=self._visible_org_ids())
        user_id = self.request.query_params.get('user_id')
        return qs.filter(user_id=user_id) if user_id and str(user_id).isdigit() else qs

    def require_hr_perm(self):
        from rest_framework.exceptions import PermissionDenied
        if not has_perm(self.request.user, self.hr_perm):
            raise PermissionDenied('Your role doesn’t allow this.')

    def hr_target_user(self, user_id):
        """Who a record is being created for: employees only for themselves;
        staff (with the permission) only for users they can see."""
        from rest_framework.exceptions import NotFound, PermissionDenied
        from apps.users.models import User
        me = self.request.user
        if me.role == 'EMPLOYEE' or not user_id or str(user_id) == str(me.id):
            if me.role != 'EMPLOYEE' and not has_perm(me, self.hr_perm):
                raise PermissionDenied('Your role doesn’t allow this.')
            return me
        self.require_hr_perm()
        target = User.objects.filter(id=user_id, organization_id__in=self._visible_org_ids()).first()
        if not target:
            raise NotFound('User not found.')
        return target

