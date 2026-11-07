"""The public property list behind the /book landing and stay-search pages."""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.bookings.models import Booking, Property, Room
from apps.tenants.models import Organization
from apps.tenants.views import OrganizationViewSet
from apps.users.models import User


def org(schema, name):
    o = Organization(schema_name=schema, name=name, tenant_type='STP', org_type='ROOM_BOOKING')
    o.auto_create_schema = False
    o.save()
    return o


class PublicListTests(TestCase):
    def setUp(self):
        self.hotel = org('h1', 'Hotel One')
        self.empty = org('h2', 'No Rooms Yet')
        prop = Property.objects.create(organization=self.hotel, name='Main')
        mk = lambda name, price, cap, amenities: Room.objects.create(  # noqa: E731
            organization=self.hotel, property=prop, name=name, price_per_night=Decimal(price),
            capacity=cap, amenities=amenities)
        self.r1 = mk('101', '1500', 2, ['WiFi', 'AC'])
        self.r2 = mk('102', '2500', 4, ['wifi ', 'Pool'])
        Room.objects.create(organization=self.hotel, property=prop, name='Closed', price_per_night=1,
                            capacity=9, is_active=False)
        guest = User.objects.create_user(username='g', email='g@example.com', password='x' * 12, role='CUSTOMER')
        self.today = date.today() + timedelta(days=3)
        Booking.objects.create(organization=self.hotel, property=prop, room=self.r1, customer=guest,
                               check_in=self.today, check_out=self.today + timedelta(days=2),
                               status='CONFIRMED', total_amount=Decimal('3000'))

    def fetch(self, **params):
        request = APIRequestFactory().get('/', params)
        return OrganizationViewSet.as_view({'get': 'public_list'})(request).data

    def test_lists_only_orgs_with_rooms_and_summarises_them(self):
        data = self.fetch()
        self.assertEqual([o['name'] for o in data], ['Hotel One'])
        h = data[0]
        self.assertEqual((h['room_count'], h['min_price'], h['max_capacity']), (2, Decimal('1500'), 4))
        self.assertEqual(h['amenities'][0], 'WiFi')  # 'WiFi' + 'wifi ' counted together
        self.assertEqual(sorted(h['amenities']), ['AC', 'Pool', 'WiFi'])
        self.assertTrue(h['auto_confirm'])
        self.assertNotIn('available_rooms', h)

    def test_availability_for_dates_and_guests(self):
        stay = {'check_in': self.today.isoformat(), 'check_out': (self.today + timedelta(days=1)).isoformat()}
        self.assertEqual(self.fetch(**stay)[0]['available_rooms'], 1)              # 101 is booked
        self.assertEqual(self.fetch(**stay, guests='3')[0]['available_rooms'], 1)  # only 102 fits
        later = {'check_in': (self.today + timedelta(days=2)).isoformat(),
                 'check_out': (self.today + timedelta(days=3)).isoformat()}
        self.assertEqual(self.fetch(**later)[0]['available_rooms'], 2)             # checkout day is free
