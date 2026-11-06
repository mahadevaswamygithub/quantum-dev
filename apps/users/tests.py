from datetime import date, time
from unittest.mock import patch
from django.db import models
from django.test import SimpleTestCase
from apps.tenants.models import Organization
from apps.users.models import User, AttendanceRecord, UserDocument, ImpersonationToken


class UserModelUnitTests(SimpleTestCase):
    def test_user_organization_properties(self):
        user = User(email="test@example.com", first_name="Alice", last_name="Smith", role="STP_USER")
        self.assertIsNone(user.organization_name)
        self.assertIsNone(user.organization_id)

        org = Organization(id=15, name="Test STP Org")
        user.organization = org

        self.assertEqual(user.organization_name, "Test STP Org")
        self.assertEqual(user.organization_id, 15)

    def test_user_string_representation(self):
        user = User(email="bob@example.com", first_name="Bob", last_name="Jones")
        self.assertEqual(str(user), "Bob Jones (bob@example.com)")


class AttendanceRecordTests(SimpleTestCase):
    def test_hours_worked_calculation_on_save(self):
        user = User(id=1, email="charlie@example.com", first_name="Charlie", last_name="Brown")

        record = AttendanceRecord(
            user=user,
            date=date(2026, 11, 1),
            status="PRESENT",
            check_in=time(9, 0),
            check_out=time(17, 30),
        )
        with patch.object(models.Model, 'save', return_value=None):
            record.save()
        self.assertEqual(record.hours_worked, 8.50)

    def test_attendance_string_representation(self):
        user = User(id=1, email="charlie@example.com", first_name="Charlie", last_name="Brown")

        record = AttendanceRecord(
            user=user,
            date=date(2026, 11, 1),
            status="PRESENT",
        )
        self.assertEqual(str(record), "Charlie Brown - 2026-11-01 - PRESENT")


class UserDocumentTests(SimpleTestCase):
    def test_document_string_representation(self):
        user = User(id=1, email="diana@example.com", first_name="Diana", last_name="Prince")

        doc = UserDocument(user=user, document_type="PASSPORT")
        self.assertEqual(str(doc), "Diana Prince - PASSPORT")


class ImpersonationTokenTests(SimpleTestCase):
    def test_impersonation_token_str(self):
        init_user = User(id=1, email="msp@example.com", first_name="MSP", last_name="SuperAdmin")
        target_user = User(id=2, email="stp@example.com", first_name="STP", last_name="LocalAdmin")
        org = Organization(id=1, name="Acme Corp")

        token = ImpersonationToken(
            initiated_by=init_user,
            target_user=target_user,
            organization=org,
        )
        self.assertEqual(str(token), "MSP SuperAdmin → STP LocalAdmin (Acme Corp)")


class MeUpdateSerializerTests(SimpleTestCase):
    """Self-service profile edits must never touch role/org/active flags."""

    def test_privilege_fields_are_not_writable(self):
        from apps.users.serializers import MeUpdateSerializer
        serializer = MeUpdateSerializer(data={
            'first_name': 'Eve', 'role': 'MSP_ADMIN', 'organization_id': 1,
            'is_active': True, 'daily_rate': '9999',
        }, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(set(serializer.validated_data), {'first_name'})


class SalarySettingsPermissionTests(SimpleTestCase):
    def test_non_admin_cannot_change_salary_settings(self):
        from unittest.mock import MagicMock
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.users.views.payroll import SalarySettingsView
        for role in ('EMPLOYEE', 'STP_USER', 'MSP_USER', 'CUSTOMER'):
            with self.subTest(role=role):
                user = MagicMock(role=role, is_authenticated=True)
                request = APIRequestFactory().put('/salary/settings/', {'default_daily_rate': '1'}, format='json')
                force_authenticate(request, user=user)
                response = SalarySettingsView.as_view({'put': 'create'})(request)
                self.assertEqual(response.status_code, 403)


class SelfServiceRoleTests(SimpleTestCase):
    """Employees/customers must not be able to edit their own role etc."""

    def _call(self, role, method, action, path, data=None):
        from unittest.mock import MagicMock
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.users.views.users import UserViewSet
        user = MagicMock(role=role, is_authenticated=True, id=5)
        request = getattr(APIRequestFactory(), method)(path, data or {}, format='json')
        force_authenticate(request, user=user)
        return UserViewSet.as_view({method: action})(request, pk='5')

    def test_self_service_roles_cannot_update_or_change_role(self):
        for role in ('EMPLOYEE', 'CUSTOMER'):
            for method, action in (('put', 'update'), ('patch', 'partial_update'), ('put', 'change_role'),
                                   ('post', 'toggle_active'), ('delete', 'destroy')):
                with self.subTest(role=role, action=action):
                    response = self._call(role, method, action, '/users/list/5/', {'role': 'STP_ADMIN'})
                    self.assertEqual(response.status_code, 403)


class ForgotPasswordEmailTests(__import__('django.test', fromlist=['TestCase']).TestCase):
    def _post(self, email):
        from rest_framework.test import APIRequestFactory
        from apps.users.views import ForgotPasswordView
        return ForgotPasswordView.as_view()(APIRequestFactory().post('/auth/forgot-password/', {'email': email}, format='json'))

    def test_matches_email_case_insensitively_and_links_guests_to_booking_login(self):
        from django.core import mail
        from apps.users.models import User
        User.objects.create_user(username='Kumar@Example.com', email='Kumar@Example.com', password='x' * 10,
                                 first_name='K', last_name='A', role='CUSTOMER')
        self.assertEqual(self._post('kumar@example.com').status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual([a.lower() for a in mail.outbox[0].to], ['kumar@example.com'])
        self.assertIn('?guest=1', mail.outbox[0].body)

    def test_unknown_email_gets_same_answer_and_no_mail(self):
        from django.core import mail
        response = self._post('nobody@example.com')
        self.assertEqual((response.status_code, len(mail.outbox)), (200, 0))

    def test_send_failure_is_logged_not_hidden(self):
        from unittest.mock import patch
        from apps.users.models import User
        User.objects.create_user(username='s@example.com', email='s@example.com', password='x' * 10,
                                 first_name='S', last_name='T', role='STP_ADMIN')
        with patch('apps.core.email.send_mail', side_effect=OSError('smtp down')), \
                self.assertLogs('apps.core.email', level='ERROR') as logs:
            self.assertEqual(self._post('s@example.com').status_code, 200)
        self.assertIn('Failed to send email', logs.output[0])
