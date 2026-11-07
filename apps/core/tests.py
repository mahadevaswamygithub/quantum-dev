from decimal import Decimal
from unittest.mock import MagicMock
from django.test import SimpleTestCase
from rest_framework import serializers

from apps.core.permissions import get_visible_organization_ids, OrganizationScopedQuerysetMixin
from apps.core.serializers import RoundedCoordinatesMixin


class DummySerializer(RoundedCoordinatesMixin, serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, required=False, allow_null=True)


class RoundedCoordinatesMixinTests(SimpleTestCase):
    def test_rounds_excess_decimal_places(self):
        data = {
            'latitude': '12.345678912',
            'longitude': '77.123456789',
        }
        serializer = DummySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['latitude'], Decimal('12.345679'))
        self.assertEqual(serializer.validated_data['longitude'], Decimal('77.123457'))

    def test_handles_none_and_empty_values(self):
        data = {
            'latitude': None,
            'longitude': '',
        }
        serializer = DummySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data.get('latitude'))

    def test_leaves_invalid_string_for_field_validation(self):
        data = {
            'latitude': 'not-a-number',
        }
        serializer = DummySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('latitude', serializer.errors)


class OrganizationScopingTests(SimpleTestCase):
    def test_user_without_organization_returns_empty_list(self):
        user = MagicMock()
        user.organization_id = None
        self.assertEqual(get_visible_organization_ids(user), [])

    def test_msp_user_includes_own_org_and_sub_orgs(self):
        user = MagicMock()
        user.organization_id = 10
        user.role = 'MSP_ADMIN'
        sub_org_mock = MagicMock()
        sub_org_mock.values_list.return_value = [20, 30]
        user.organization.sub_organizations = sub_org_mock

        # include_own_org=True
        self.assertEqual(get_visible_organization_ids(user, include_own_org=True), [10, 20, 30])
        # include_own_org=False
        self.assertEqual(get_visible_organization_ids(user, include_own_org=False), [20, 30])

    def test_stp_user_returns_own_org_only(self):
        for role in ('STP_ADMIN', 'STP_USER', 'CUSTOMER'):
            user = MagicMock()
            user.organization_id = 42
            user.role = role
            self.assertEqual(get_visible_organization_ids(user), [42])

    def test_employee_or_other_role_returns_none(self):
        user = MagicMock()
        user.organization_id = 99
        user.role = 'EMPLOYEE'
        self.assertIsNone(get_visible_organization_ids(user))


class OrganizationScopedQuerysetMixinTests(SimpleTestCase):
    def test_queryset_scoped_to_organization_lookup(self):
        mixin = OrganizationScopedQuerysetMixin()
        mixin.request = MagicMock()
        mixin.request.user.organization_id = 5
        mixin.request.user.role = 'STP_ADMIN'

        base_qs = MagicMock()
        mixin.get_organization_scoped_queryset(base_qs)
        base_qs.filter.assert_called_once_with(organization__in=[5])

    def test_queryset_scoped_when_model_is_organization_itself(self):
        mixin = OrganizationScopedQuerysetMixin()
        mixin.organization_lookup = ''
        mixin.request = MagicMock()
        mixin.request.user.organization_id = 5
        mixin.request.user.role = 'STP_ADMIN'

        base_qs = MagicMock()
        mixin.get_organization_scoped_queryset(base_qs)
        base_qs.filter.assert_called_once_with(id__in=[5])

    def test_returns_none_qs_when_unscoped_role(self):
        mixin = OrganizationScopedQuerysetMixin()
        mixin.request = MagicMock()
        mixin.request.user.organization_id = 5
        mixin.request.user.role = 'EMPLOYEE'

        base_qs = MagicMock()
        mixin.get_organization_scoped_queryset(base_qs)
        base_qs.none.assert_called_once()
