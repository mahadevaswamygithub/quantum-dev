"""Role-based access for MSP/STP staff (apps.core.access), enforced by the API."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Booking, Payment, Property, Room
from apps.tenants.models import Organization
from apps.users.models import OrgRole, SalaryRecord, User


def make_org(name, tenant_type='STP', org_type='ROOM_BOOKING', parent=None):
    org = Organization(schema_name=name, name=name, tenant_type=tenant_type,
                       org_type=org_type if tenant_type == 'STP' else None, parent_organization=parent)
    org.auto_create_schema = False
    org.save()  # post_save seeds the preset roles
    return org


def make_user(username, org, role, access_role=None):
    return User.objects.create_user(username=username, email=f'{username}@example.com', password='x' * 10,
                                    organization=org, role=role,
                                    access_role=OrgRole.objects.get(organization=org, name=access_role) if access_role else None)


def call(view, user, method='get', path='/', data=None, **kwargs):
    request = getattr(APIRequestFactory(), method)(path, data or {}, format='json')
    force_authenticate(request, user=user)
    return view(request, **kwargs)


class AccessTestBase(TestCase):
    def setUp(self):
        self.org = make_org('hotel')
        self.admin = make_user('admin', self.org, 'STP_ADMIN')
        self.desk = make_user('desk', self.org, 'STP_USER', 'Front desk')
        self.cashier = make_user('cash', self.org, 'STP_USER', 'Cashier')
        prop = Property.objects.create(organization=self.org, name='Main')
        self.room = Room.objects.create(organization=self.org, property=prop, name='101', price_per_night=Decimal('100'))
        self.guest = User.objects.create_user(username='g', email='g@example.com', password='x' * 10, role='CUSTOMER')
        self.booking = Booking.objects.create(
            organization=self.org, property=prop, room=self.room, customer=self.guest,
            check_in=date.today() + timedelta(days=5), check_out=date.today() + timedelta(days=6),
            status='PENDING', payment_method='AT_PROPERTY', total_amount=Decimal('100'))


class PresetSeedingTests(AccessTestBase):
    def test_new_org_gets_presets(self):
        self.assertEqual(set(OrgRole.objects.filter(organization=self.org).values_list('name', flat=True)),
                         {'Manager', 'Front desk', 'Cashier', 'Viewer'})
        msp = make_org('msp', tenant_type='MSP')
        self.assertIn('Account manager', OrgRole.objects.filter(organization=msp).values_list('name', flat=True))

    def test_permissions_on_user_payload(self):
        from apps.users.serializers import UserSerializer
        data = UserSerializer(self.desk).data
        self.assertEqual(data['access_role']['name'], 'Front desk')
        self.assertIn('bookings.manage', data['permissions'])
        self.assertNotIn('payments.refund', data['permissions'])
        self.assertIn('settings.manage', UserSerializer(self.admin).data['permissions'])


class BookingAccessTests(AccessTestBase):
    def act(self, user, action):
        from apps.bookings.views import BookingViewSet
        return call(BookingViewSet.as_view({'post': action}), user, 'post', pk=self.booking.id)

    def test_front_desk_confirms_but_cannot_refund(self):
        self.assertEqual(self.act(self.desk, 'confirm').status_code, 200)
        Payment.objects.create(booking=self.booking, razorpay_order_id='o', amount=Decimal('100'), status='PAID')
        self.assertEqual(self.act(self.desk, 'refund').status_code, 403)

    @patch('apps.bookings.services.refund_payment')
    def test_cashier_refunds_but_cannot_confirm(self, _refund):
        self.assertEqual(self.act(self.cashier, 'confirm').status_code, 403)
        Booking.objects.filter(pk=self.booking.pk).update(status='CONFIRMED')
        Payment.objects.create(booking=self.booking, razorpay_order_id='o', amount=Decimal('100'), status='PAID')
        self.assertEqual(self.act(self.cashier, 'refund').status_code, 200)

    def test_room_management_needs_rooms_manage(self):
        from apps.bookings.views import RoomViewSet
        data = {'name': '102', 'price_per_night': '100', 'property': self.room.property_id, 'capacity': 1}
        self.assertEqual(call(RoomViewSet.as_view({'post': 'create'}), self.desk, 'post', data=data).status_code, 403)
        self.assertEqual(call(RoomViewSet.as_view({'post': 'create'}), self.admin, 'post', data=data).status_code, 201)

    def test_cashier_cannot_see_rooms_list(self):
        from apps.bookings.views import RoomViewSet
        self.assertEqual(call(RoomViewSet.as_view({'get': 'list'}), self.cashier).data, [])

    def test_booking_settings_change_needs_settings_manage(self):
        from apps.bookings.views import BookingSettingsView
        self.assertEqual(call(BookingSettingsView.as_view(), self.desk, 'patch', data={'auto_confirm': False}).status_code, 403)
        self.assertEqual(call(BookingSettingsView.as_view(), self.admin, 'patch', data={'auto_confirm': False}).status_code, 200)


class UserManagementAccessTests(AccessTestBase):
    def setUp(self):
        super().setUp()
        self.manager = make_user('mgr', self.org, 'STP_USER', 'Manager')

    def test_front_desk_cannot_list_users(self):
        from apps.users.views import UserViewSet
        self.assertEqual(call(UserViewSet.as_view({'get': 'list'}), self.desk).status_code, 403)

    def test_manager_adds_staff_with_a_role_but_not_admins(self):
        from apps.users.views import UserViewSet
        view = UserViewSet.as_view({'post': 'create'})
        cashier_role = OrgRole.objects.get(organization=self.org, name='Cashier')
        ok = call(view, self.manager, 'post', data={
            'username': 'new', 'email': 'new@example.com', 'first_name': 'N', 'last_name': 'U',
            'role': 'STP_USER', 'organization_id': self.org.id, 'access_role_id': cashier_role.id})
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(User.objects.get(username='new').access_role, cashier_role)
        bad = call(view, self.manager, 'post', data={
            'username': 'boss2', 'email': 'boss2@example.com', 'first_name': 'B', 'last_name': 'X',
            'role': 'STP_ADMIN', 'organization_id': self.org.id})
        self.assertEqual(bad.status_code, 400)
        self.assertIn('role', bad.data)

    def test_manager_cannot_promote_self_or_touch_admin(self):
        from apps.users.views import UserViewSet
        self.assertEqual(call(UserViewSet.as_view({'put': 'change_role'}), self.manager, 'put',
                              data={'role': 'STP_ADMIN'}, pk=self.manager.id).status_code, 403)
        self.assertEqual(call(UserViewSet.as_view({'post': 'toggle_active'}), self.manager, 'post',
                              pk=self.admin.id).status_code, 403)

    def test_bulk_delete_only_affects_own_org(self):
        from apps.users.views import UserViewSet
        other = make_org('other')
        victim = make_user('victim', other, 'STP_USER', 'Viewer')
        call(UserViewSet.as_view({'post': 'bulk_delete'}), self.admin, 'post', data={'user_ids': [victim.id]})
        self.assertTrue(User.objects.filter(pk=victim.pk).exists())


class OrganizationAndAdminAccessTests(AccessTestBase):
    def test_guests_and_stp_staff_cannot_create_organizations(self):
        from apps.tenants.views import OrganizationViewSet
        data = {'name': 'Evil', 'tenant_type': 'STP', 'org_type': 'ROOM_BOOKING',
                'admin_first_name': 'a', 'admin_last_name': 'b', 'admin_email': 'evil@example.com'}
        for user in (self.guest, self.admin):
            self.assertEqual(call(OrganizationViewSet.as_view({'post': 'create'}), user, 'post', data=data).status_code, 403)

    def test_msp_support_can_view_but_not_edit_orgs(self):
        from apps.tenants.views import OrganizationViewSet
        msp = make_org('msp', tenant_type='MSP')
        Organization.objects.filter(pk=self.org.pk).update(parent_organization=msp)
        support = make_user('support', msp, 'MSP_USER', 'Support')
        self.assertEqual(call(OrganizationViewSet.as_view({'get': 'list'}), support).status_code, 200)
        self.assertEqual(call(OrganizationViewSet.as_view({'post': 'toggle_status'}), support, 'post', pk=self.org.id).status_code, 403)

    def test_activity_log_needs_activity_view(self):
        from apps.activity.views import ActivityLogViewSet
        data = call(ActivityLogViewSet.as_view({'get': 'list'}), self.desk).data
        rows = data['results'] if isinstance(data, dict) else data
        self.assertEqual(list(rows), [])


class HRAccessTests(AccessTestBase):
    def test_salary_records_need_hr_payroll_and_stay_in_org(self):
        from apps.users.views import SalaryRecordViewSet
        emp = make_user('emp', self.org, 'EMPLOYEE')
        other_emp = make_user('emp2', make_org('other'), 'EMPLOYEE')
        for e in (emp, other_emp):
            SalaryRecord.objects.create(user=e, month='2030-01', days_present=1, daily_rate=Decimal('1'))
        view = SalaryRecordViewSet.as_view({'get': 'list'})
        self.assertEqual(len(call(view, self.desk).data), 0)          # no hr.payroll
        rows = call(view, self.admin).data
        self.assertEqual([r['user'] for r in rows], [emp.id])           # own org only
        self.assertEqual(len(call(view, self.guest).data), 0)          # guests: nothing
        self.assertEqual(len(call(view, emp).data), 1)                 # employee: own


class RoleApiTests(AccessTestBase):
    def test_only_admin_edits_roles_and_codes_are_validated(self):
        from apps.users.views import OrgRoleViewSet
        create = OrgRoleViewSet.as_view({'post': 'create'})
        self.assertEqual(call(create, self.desk, 'post', data={'name': 'X', 'permissions': []}).status_code, 403)
        bad = call(create, self.admin, 'post', data={'name': 'X', 'permissions': ['organizations.manage']})
        self.assertEqual(bad.status_code, 400)  # MSP-only permission on an STP org
        ok = call(create, self.admin, 'post', data={'name': 'Night', 'permissions': ['bookings.manage']})
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(sorted(ok.data['permissions']), ['bookings.manage', 'bookings.view'])  # manage implies view

    def test_role_in_use_cannot_be_deleted(self):
        from apps.users.views import OrgRoleViewSet
        role = OrgRole.objects.get(organization=self.org, name='Front desk')
        response = call(OrgRoleViewSet.as_view({'delete': 'destroy'}), self.admin, 'delete', pk=role.id)
        self.assertEqual(response.status_code, 400)
        self.assertTrue(OrgRole.objects.filter(pk=role.pk).exists())
