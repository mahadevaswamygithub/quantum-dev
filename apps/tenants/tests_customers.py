"""Customer accounts: sign-up, approval, suspension, hotel limits, the platform
console, and that one customer can never reach another customer's data."""
from decimal import Decimal
from io import StringIO
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.models import Property, Room
from apps.bookings.views import PropertyViewSet
from apps.tenants.models import Organization
from apps.tenants.onboarding import create_customer, create_organization
from apps.tenants.platform_views import PlatformCustomerViewSet
from apps.tenants.views import OrganizationViewSet
from apps.users.models import User
from apps.users.views import LoginView, UserRegistrationView, UserViewSet

PASSWORD = 'Blue-Harbor-2931'
no_schema = patch.object(Organization, 'auto_create_schema', False)   # skip CREATE SCHEMA: fast tests


def call(view, method='get', data=None, user=None, token=None, **kwargs):
    factory = APIRequestFactory()
    extra = {'HTTP_AUTHORIZATION': f'Bearer {token}'} if token else {}
    request = getattr(factory, method)('/', data or {}, format='json', **extra)
    if user:
        force_authenticate(request, user=user)
    return view(request, **kwargs)


def login(email):
    return call(LoginView.as_view(), 'post', {'email': email, 'password': PASSWORD})


@override_settings(ALLOW_PUBLIC_ORG_SIGNUP=True, SIGNUP_PROPERTY_LIMIT=2, TWO_FACTOR_REQUIRED_ROLES=[])
class CustomerLifecycleTests(TestCase):
    def setUp(self):
        cache.clear()
        no_schema.start()
        self.addCleanup(no_schema.stop)
        self.public = Organization.objects.create(schema_name='public', name='Public', tenant_type='MSP')
        self.owner = User.objects.create_user(username='owner', email='owner@corex.test', password=PASSWORD,
                                              role='PLATFORM_ADMIN', organization=self.public)

    def signup(self, **extra):
        data = {'organization_name': 'Green Stays', 'first_name': 'Ravi', 'last_name': 'K',
                'email': 'ravi@green.test', **extra}
        with self.captureOnCommitCallbacks(execute=True):   # emails go out after commit
            return call(UserRegistrationView.as_view(), 'post', data)

    def test_signup_creates_pending_stp_and_emails_owner_and_customer(self):
        r = self.signup()
        self.assertEqual(r.status_code, 201, r.data)
        admin = User.objects.get(email='ravi@green.test')
        org = admin.organization
        self.assertEqual((org.tenant_type, org.org_type, org.status, org.signed_up, org.property_limit),
                         ('STP', 'ROOM_BOOKING', 'PENDING', True, 2))
        self.assertEqual(admin.role, 'STP_ADMIN')
        self.assertFalse(admin.has_usable_password())                    # sets it from the emailed link
        self.assertIsNone(org.parent_organization)
        subjects = sorted(m.subject for m in mail.outbox)
        self.assertTrue(any(s.startswith('Welcome to CoreX') for s in subjects), subjects)
        welcome = next(m for m in mail.outbox if m.subject.startswith('Welcome to CoreX'))
        self.assertIn('/reset-password/', welcome.body)
        self.assertIn('approves', welcome.body)                          # pending: says it goes live after review
        self.assertTrue(any('waiting for approval' in s for s in subjects), subjects)
        self.assertFalse(Organization.objects.bookable().filter(id=org.id).exists())   # hidden from guests

        r = self.signup(email='taj@group.test', organization_name='Taj Group', account_type='MSP')
        taj = User.objects.get(email='taj@group.test')
        self.assertEqual((taj.role, taj.organization.tenant_type, taj.organization.org_type), ('MSP_ADMIN', 'MSP', None))
        self.assertEqual(self.signup().status_code, 400)                # same email again

    def test_pending_can_sign_in_approve_makes_it_live_suspend_signs_staff_out(self):
        self.signup()
        admin = User.objects.get(email='ravi@green.test')
        admin.set_password(PASSWORD)
        admin.save()
        org = admin.organization
        r = login(admin.email)
        self.assertEqual(r.status_code, 200, r.data)                    # pending: may sign in to set up
        self.assertEqual(r.data['user']['account_status'], 'PENDING')
        token = r.data['access']
        me = UserViewSet.as_view({'get': 'me'})
        self.assertEqual(call(me, token=token).status_code, 200)

        console = PlatformCustomerViewSet.as_view({'post': 'approve'})
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(call(console, 'post', user=self.owner, pk=org.id).status_code, 200)
        self.assertTrue(Organization.objects.bookable().filter(id=org.id).exists())
        self.assertTrue(any('approved' in m.subject for m in mail.outbox))

        suspend = PlatformCustomerViewSet.as_view({'post': 'suspend'})
        r = call(suspend, 'post', {'reason': 'Unpaid invoice'}, user=self.owner, pk=org.id)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(call(me, token=token).status_code, 401)         # signed out at once
        r = login(admin.email)
        self.assertEqual(r.status_code, 403)
        self.assertIn('suspended', r.data['error'])
        self.assertFalse(Organization.objects.bookable().filter(id=org.id).exists())

        reactivate = PlatformCustomerViewSet.as_view({'post': 'reactivate'})
        self.assertEqual(call(reactivate, 'post', user=self.owner, pk=org.id).status_code, 200)
        self.assertEqual(login(admin.email).status_code, 200)

    def test_suspending_a_group_blocks_and_hides_its_hotels(self):
        group, _ = create_customer(account_type='MSP', name='Taj Group', first_name='T', last_name='G',
                                   email='t@g.test')
        hotel = create_organization('Taj Goa', 'STP', parent=group)
        manager = User.objects.create_user(username='m', email='m@goa.test', password=PASSWORD, role='STP_ADMIN',
                                           organization=hotel)
        self.assertTrue(Organization.objects.bookable().filter(id=hotel.id).exists())
        call(PlatformCustomerViewSet.as_view({'post': 'suspend'}), 'post', user=self.owner, pk=group.id)
        self.assertFalse(Organization.objects.bookable().filter(id=hotel.id).exists())
        self.assertEqual(login(manager.email).status_code, 403)
        # A hotel switched off by its group: staff can't sign in either (was possible before).
        call(PlatformCustomerViewSet.as_view({'post': 'reactivate'}), 'post', user=self.owner, pk=group.id)
        hotel.is_active = False
        hotel.save()
        self.assertEqual(login(manager.email).status_code, 403)

    def test_console_is_platform_owner_only_and_limits_work(self):
        group, group_admin = create_customer(account_type='MSP', name='Taj Group', first_name='T', last_name='G',
                                             email='t@g.test', property_limit=1)
        group_admin.set_password(PASSWORD)
        group_admin.save()
        listing = PlatformCustomerViewSet.as_view({'get': 'list', 'post': 'create'})
        self.assertEqual(call(listing, user=group_admin).status_code, 403)
        rows = call(listing, user=self.owner).data
        self.assertEqual([r['name'] for r in rows], ['Taj Group'])      # "public" is not a customer

        add = OrganizationViewSet.as_view({'post': 'create'})
        hotel = {'name': 'Taj Goa', 'org_type': 'ROOM_BOOKING', 'admin_first_name': 'M', 'admin_last_name': 'G',
                 'admin_email': 'm@goa.test'}
        self.assertEqual(call(add, 'post', hotel, user=group_admin).status_code, 201)
        r = call(add, 'post', {**hotel, 'name': 'Taj Ooty', 'admin_email': 'm@ooty.test'}, user=group_admin)
        self.assertEqual(r.status_code, 400)
        self.assertIn('plan allows 1 hotel', str(r.data))

        edit = PlatformCustomerViewSet.as_view({'patch': 'partial_update'})
        self.assertEqual(call(edit, 'patch', {'property_limit': 5}, user=self.owner, pk=group.id).data['property_limit'], 5)
        group_admin = User.objects.get(pk=group_admin.pk)              # each request loads the user afresh
        r = call(add, 'post', {**hotel, 'name': 'Taj Ooty', 'admin_email': 'm@ooty.test'}, user=group_admin)
        self.assertEqual(r.status_code, 201, r.data)

        created = call(listing, 'post', {'name': 'Hill Inn', 'first_name': 'H', 'last_name': 'I',
                                         'email': 'h@hill.test', 'property_limit': 1}, user=self.owner)
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual((created.data['status'], created.data['account_type']), ('ACTIVE', 'STP'))

    def test_welcome_email_and_resend(self):
        listing = PlatformCustomerViewSet.as_view({'post': 'create'})
        with self.captureOnCommitCallbacks(execute=True):
            r = call(listing, 'post', {'name': 'Hill Inn', 'first_name': 'Hema', 'last_name': 'I',
                                       'email': 'hema@hill.test'}, user=self.owner)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(mail.outbox), 1)
        msg = mail.outbox[0]
        self.assertEqual(msg.to, ['hema@hill.test'])
        self.assertEqual(msg.subject, 'Welcome to CoreX: set your password for Hill Inn')
        self.assertIn('is ready', msg.body)                               # created by the owner: ready to use
        html = msg.alternatives[0][0]
        self.assertIn('Set your password', html)
        self.assertIn('/reset-password/', html)

        resend = PlatformCustomerViewSet.as_view({'post': 'resend_welcome'})
        mail.outbox.clear()
        r = call(resend, 'post', user=self.owner, pk=r.data['id'])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['sent'], ['hema@hill.test'])
        self.assertEqual(len(mail.outbox), 1)

        admin = User.objects.get(email='hema@hill.test')        # once the password is set: no more resends
        admin.set_password(PASSWORD)
        admin.save()
        org_id = admin.organization.id
        self.assertEqual(call(resend, 'post', user=self.owner, pk=org_id).status_code, 400)
        hotel_admin = User.objects.create_user(username='x', email='x@x.test', password=PASSWORD, role='STP_ADMIN')
        self.assertEqual(call(resend, 'post', user=hotel_admin, pk=org_id).status_code, 403)

    def test_single_business_property_limit(self):
        org, admin = create_customer(account_type='STP', name='Hill Inn', first_name='H', last_name='I',
                                     email='h@hill.test', property_limit=1)
        create = PropertyViewSet.as_view({'post': 'create'})
        self.assertEqual(call(create, 'post', {'name': 'Main block'}, user=admin).status_code, 201)
        r = call(create, 'post', {'name': 'Annexe'}, user=admin)
        self.assertEqual(r.status_code, 403)
        self.assertIn('plan allows 1 property', r.data['error'])

    def test_one_customer_never_sees_or_adds_into_another(self):
        a, a_admin = create_customer(account_type='MSP', name='Alpha Group', first_name='A', last_name='A', email='a@a.test')
        b, _ = create_customer(account_type='MSP', name='Bravo Group', first_name='B', last_name='B', email='b@b.test')
        b_hotel = create_organization('Bravo Goa', 'STP', parent=b)
        Room.objects.create(organization=b_hotel, name='101', price_per_night=Decimal('1000'))
        orgs = OrganizationViewSet.as_view({'get': 'list', 'post': 'create'})
        self.assertEqual(call(orgs, user=a_admin).data, [])
        detail = OrganizationViewSet.as_view({'get': 'retrieve'})
        self.assertEqual(call(detail, user=a_admin, pk=b_hotel.id).status_code, 404)
        r = call(orgs, 'post', {'name': 'Sneaky', 'org_type': 'ROOM_BOOKING', 'parent_organization_id': b.id,
                                'admin_first_name': 'S', 'admin_last_name': 'S', 'admin_email': 's@s.test'}, user=a_admin)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(b.sub_organizations.filter(name='Sneaky').exists())
        r = call(orgs, 'post', {'name': 'New MSP', 'tenant_type': 'MSP', 'admin_first_name': 'S',
                                'admin_last_name': 'S', 'admin_email': 's@s.test'}, user=a_admin)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Property.objects.filter(organization=b_hotel).exists())

    def test_platform_role_cannot_be_granted_by_customers(self):
        org, admin = create_customer(account_type='STP', name='Hill Inn', first_name='H', last_name='I', email='h@hill.test')
        users = UserViewSet.as_view({'post': 'create'})
        r = call(users, 'post', {'username': 'x', 'email': 'x@hill.test', 'first_name': 'X', 'last_name': 'Y',
                                 'role': 'PLATFORM_ADMIN', 'organization_id': org.id}, user=admin)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(role='PLATFORM_ADMIN').exclude(id=self.owner.id).exists())

    def test_create_platform_admin_command(self):
        out = StringIO()
        call_command('create_platform_admin', email='Asha@CoreX.test', first_name='Asha', print_link=True, stdout=out)
        user = User.objects.get(email='asha@corex.test')
        self.assertEqual((user.role, user.organization_id), ('PLATFORM_ADMIN', self.public.id))
        self.assertIn('/reset-password/', out.getvalue())
