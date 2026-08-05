"""
Shared, cross-app role-scoping helpers.

CoreX's roles (MSP_ADMIN/MSP_USER, STP_ADMIN/STP_USER, EMPLOYEE) determine
which organizations — and therefore which users/records within them — a
request is allowed to see. That "which org IDs is this user allowed to see"
rule used to be copy-pasted separately in apps.users and apps.tenants; it
now lives here once.
"""


def get_visible_organization_ids(user, include_own_org=True):
    """
    Returns the list of Organization IDs `user` is allowed to see, based on
    role:
      - MSP_ADMIN / MSP_USER → all of their org's sub-organizations, plus
        their own org when `include_own_org` is True (default). Pass
        include_own_org=False for call sites that only want the managed
        sub-orgs (e.g. an "organizations I administer" list).
      - STP_ADMIN / STP_USER → their own org only
      - anything else (e.g. EMPLOYEE, or no org) → None, meaning "this role
        isn't org-scoped the same way; caller decides what to do" (e.g.
        scope to the user themself, or return nothing)
    """
    if not user.organization_id:
        return []
    if user.role in ('MSP_ADMIN', 'MSP_USER'):
        sub_ids = list(user.organization.sub_organizations.values_list('id', flat=True))
        return ([user.organization_id] + sub_ids) if include_own_org else sub_ids
    if user.role in ('STP_ADMIN', 'STP_USER'):
        return [user.organization_id]
    return None


class OrganizationScopedQuerysetMixin:
    """
    Mixin for ViewSets whose get_queryset() should be limited to the
    organizations the requesting user can see.

    Set `organization_lookup` to the field path from the model to its
    Organization: '' when the model IS Organization itself, 'organization'
    (the default) when the model has an `organization` FK such as User.
    """
    organization_lookup = 'organization'
    include_own_org = True

    def get_organization_scoped_queryset(self, base_qs):
        org_ids = get_visible_organization_ids(self.request.user, include_own_org=self.include_own_org)
        if org_ids is None:
            return base_qs.none()
        lookup = f'{self.organization_lookup}__in' if self.organization_lookup else 'id__in'
        return base_qs.filter(**{lookup: org_ids})
