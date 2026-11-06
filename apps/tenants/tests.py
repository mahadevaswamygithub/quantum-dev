from decimal import Decimal
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase
from apps.tenants.serializers import (
    OrganizationSerializer, OrganizationCreateSerializer, OrganizationUpdateSerializer,
)
from apps.tenants.models import Organization


class OrganizationSerializerTests(SimpleTestCase):
    def test_get_parent_name_none_when_no_parent(self):
        org = MagicMock(spec=Organization)
        org.parent_organization = None
        serializer = OrganizationSerializer()
        self.assertIsNone(serializer.get_parent_name(org))

    def test_get_parent_name_returns_name(self):
        parent = MagicMock(spec=Organization)
        parent.name = "Parent MSP Corp"
        org = MagicMock(spec=Organization)
        org.parent_organization = parent
        serializer = OrganizationSerializer()
        self.assertEqual(serializer.get_parent_name(org), "Parent MSP Corp")


class OrganizationCreateSerializerTests(SimpleTestCase):
    @patch('apps.tenants.serializers.User.objects.filter')
    def test_msp_cannot_have_parent_organization(self, mock_user_filter):
        mock_user_filter.return_value.exists.return_value = False

        data = {
            'name': 'Test MSP',
            'tenant_type': 'MSP',
            'parent_organization_id': 99,
            'admin_first_name': 'John',
            'admin_last_name': 'Doe',
            'admin_email': 'john@example.com',
        }
        mock_parent = MagicMock()
        mock_parent.tenant_type = 'MSP'
        with patch('apps.tenants.serializers.Organization.objects.get', return_value=mock_parent):
            serializer = OrganizationCreateSerializer(data=data)
            self.assertFalse(serializer.is_valid())
            self.assertIn("MSP cannot have a parent organization", str(serializer.errors))

    @patch('apps.tenants.serializers.User.objects.filter')
    def test_stp_requires_org_type(self, mock_user_filter):
        mock_user_filter.return_value.exists.return_value = False

        data = {
            'name': 'Test STP',
            'tenant_type': 'STP',
            'org_type': None,
            'admin_first_name': 'Jane',
            'admin_last_name': 'Doe',
            'admin_email': 'jane@example.com',
        }
        serializer = OrganizationCreateSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('org_type', serializer.errors)

    @patch('apps.tenants.serializers.User.objects.filter')
    def test_msp_forces_org_type_to_none(self, mock_user_filter):
        mock_user_filter.return_value.exists.return_value = False

        data = {
            'name': 'Valid MSP Org',
            'tenant_type': 'MSP',
            'org_type': 'ROOM_BOOKING',  # Should be cleared for MSP
            'admin_first_name': 'Admin',
            'admin_last_name': 'User',
            'admin_email': 'admin@example.com',
        }
        serializer = OrganizationCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data.get('org_type'))

    @patch('apps.tenants.serializers.User.objects.filter')
    def test_rounds_latitude_longitude_on_create(self, mock_user_filter):
        mock_user_filter.return_value.exists.return_value = False

        data = {
            'name': 'STP with Coordinates',
            'tenant_type': 'STP',
            'org_type': 'ROOM_BOOKING',
            'latitude': '13.082680123',
            'longitude': '80.270718999',
            'admin_first_name': 'Coord',
            'admin_last_name': 'Admin',
            'admin_email': 'coord@example.com',
        }
        serializer = OrganizationCreateSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['latitude'], Decimal('13.082680'))
        self.assertEqual(serializer.validated_data['longitude'], Decimal('80.270719'))

    @patch('apps.tenants.serializers.User.objects.filter')
    def test_unbuilt_org_types_rejected_on_create(self, mock_user_filter):
        mock_user_filter.return_value.exists.return_value = False
        for org_type in ('HOTEL', 'HOSPITAL', 'OTHER'):
            with self.subTest(org_type=org_type):
                serializer = OrganizationCreateSerializer(data={
                    'name': 'Not Yet', 'tenant_type': 'STP', 'org_type': org_type,
                    'admin_first_name': 'A', 'admin_last_name': 'B',
                    'admin_email': 'a@example.com',
                })
                self.assertFalse(serializer.is_valid())
                self.assertIn('org_type', serializer.errors)


class OrganizationUpdateSerializerOrgTypeTests(SimpleTestCase):
    def _org(self, org_type):
        org = MagicMock(spec=Organization)
        org.tenant_type = 'STP'
        org.org_type = org_type
        return org

    def test_cannot_switch_to_unbuilt_org_type(self):
        serializer = OrganizationUpdateSerializer(
            instance=self._org('ROOM_BOOKING'), data={'org_type': 'HOTEL'}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('org_type', serializer.errors)

    def test_existing_unbuilt_org_type_can_be_kept(self):
        serializer = OrganizationUpdateSerializer(
            instance=self._org('HOTEL'), data={'org_type': 'HOTEL'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_can_set_room_booking(self):
        serializer = OrganizationUpdateSerializer(
            instance=self._org(None), data={'org_type': 'ROOM_BOOKING'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)


class OwnOrganizationPermissionTests(SimpleTestCase):
    def _call(self, view_action, method, role, path):
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.tenants.views import OrganizationViewSet
        user = MagicMock(role=role, is_authenticated=True)
        factory = APIRequestFactory()
        request = getattr(factory, method)(path, {'name': 'Hijacked'}, format='json')
        force_authenticate(request, user=user)
        return OrganizationViewSet.as_view({method: view_action})(request)

    def test_non_admin_staff_cannot_edit_own_org(self):
        for role in ('STP_USER', 'MSP_USER'):
            with self.subTest(role=role):
                self.assertEqual(self._call('mine', 'patch', role, '/mine/').status_code, 403)

    def test_customers_and_employees_have_no_org_settings(self):
        for role in ('CUSTOMER', 'EMPLOYEE'):
            with self.subTest(role=role):
                self.assertEqual(self._call('mine', 'get', role, '/mine/').status_code, 404)

    def test_platform_status_is_msp_admin_only(self):
        for role in ('MSP_USER', 'STP_ADMIN', 'CUSTOMER'):
            with self.subTest(role=role):
                self.assertEqual(self._call('platform_status', 'get', role, '/platform_status/').status_code, 403)


class CoverPhotoPermissionTests(SimpleTestCase):
    def test_only_org_admins_can_change_cover(self):
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.tenants.views import OrganizationViewSet
        for role in ('STP_USER', 'MSP_USER', 'CUSTOMER', 'EMPLOYEE'):
            with self.subTest(role=role):
                request = APIRequestFactory().delete('/mine/cover/')
                force_authenticate(request, user=MagicMock(role=role, is_authenticated=True))
                response = OrganizationViewSet.as_view({'delete': 'mine_cover'})(request)
                self.assertEqual(response.status_code, 403)
