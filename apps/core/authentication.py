"""JWT authentication that also honours the organization's account status.

Checked on every request (not only at login), so suspending a customer or
deactivating an organization takes effect at once for staff who are already
signed in. Guests (CUSTOMER) and the platform owner aren't tied to one
organization's status.
"""
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

ORG_BOUND_ROLES = ('MSP_ADMIN', 'MSP_USER', 'STP_ADMIN', 'STP_USER', 'EMPLOYEE')


def org_sign_in_problem(user):
    """Why this user's organization stops them signing in, or ''."""
    if user.role not in ORG_BOUND_ROLES or not user.organization_id:
        return ''
    return user.organization.sign_in_problem()


class OrgStatusJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        from apps.users.models import User
        try:
            user_id = validated_token[api_settings.USER_ID_CLAIM]
        except KeyError:
            return super().get_user(validated_token)
        user = (User.objects.select_related('organization__parent_organization')
                .filter(**{api_settings.USER_ID_FIELD: user_id}).first())
        if user is None or not user.is_active:
            return super().get_user(validated_token)  # same errors as before
        problem = org_sign_in_problem(user)
        if problem:
            raise AuthenticationFailed(problem, code='organization_inactive')
        return user
