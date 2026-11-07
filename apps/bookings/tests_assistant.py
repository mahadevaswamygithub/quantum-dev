"""Guest chat assistant on the booking site."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings import assistant
from apps.bookings.assistant import inr, parse_budget, parse_dates, parse_guests, short_place
from apps.bookings.models import Booking, BookingSettings, Property, Room
from apps.bookings.views import GuestAssistantView
from apps.tenants.models import Organization
from apps.users.models import User


class ParsingTests(SimpleTestCase):
    today = date(2026, 11, 7)  # a Saturday

    def test_dates(self):
        t = self.today
        self.assertEqual(parse_dates('rooms tonight', t), (t, t + timedelta(days=1)))
        self.assertEqual(parse_dates('tomorrow for 3 nights', t), (t + timedelta(days=1), t + timedelta(days=4)))
        self.assertEqual(parse_dates('this weekend', t), (t, t + timedelta(days=2)))
        self.assertEqual(parse_dates('from 12 nov to 15 nov', t), (date(2026, 11, 12), date(2026, 11, 15)))
        self.assertEqual(parse_dates('jan 3rd', t), (date(2027, 1, 3), date(2027, 1, 4)))   # past month -> next year
        self.assertEqual(parse_dates('2026-11-20 2026-11-22', t), (date(2026, 11, 20), date(2026, 11, 22)))
        self.assertEqual(parse_dates('any rooms?', t), (None, None))

    def test_guests_budget_place_money(self):
        self.assertEqual(parse_guests('room for 3 people'), 3)
        self.assertEqual(parse_guests('for 2 nights'), None)
        self.assertEqual(parse_budget('under ₹2,500'), 2500)
        self.assertEqual(parse_budget('below 3k'), 3000)
        self.assertEqual(short_place('12 Beach Rd, Puducherry 605001'), 'Puducherry')
        self.assertEqual(inr(1234567), '₹12,34,567')


@override_settings(GUEST_ASSISTANT_LLM=False)
class AssistantTests(TestCase):
    def setUp(self):
        def org(schema, name, address, price, amenities, cap=2):
            o = Organization(schema_name=schema, name=name, tenant_type='STP', org_type='ROOM_BOOKING',
                             address=address, contact_phone='+91 90000 00000')
            o.auto_create_schema = False
            o.save()
            prop = Property.objects.create(organization=o, name='Main')
            room = Room.objects.create(organization=o, property=prop, name='101', price_per_night=Decimal(price),
                                       capacity=cap, amenities=amenities)
            return o, room
        self.lake, self.lake_room = org('l', 'Lake View Inn', 'MG Road, Mysuru', '1800', ['WiFi', 'AC'])
        self.hill, self.hill_room = org('h', 'Hill Top Stay', 'Charing Cross, Ooty', '3200', ['Pool', 'WiFi'], cap=4)
        BookingSettings.objects.create(organization=self.lake, free_cancellation_hours=48)
        self.guest = User.objects.create_user(username='g', email='g@example.com', password='x' * 12,
                                              first_name='Asha', role='CUSTOMER')
        self.tomorrow = date.today() + timedelta(days=1)

    def ask(self, message, user=None, **context):
        request = APIRequestFactory().post('/', {'message': message, 'context': context}, format='json')
        if user:
            force_authenticate(request, user=user)
        resp = GuestAssistantView.as_view()(request)
        self.assertEqual(resp.status_code, 200, resp.data)
        return resp.data

    def test_search_by_place_budget_and_amenity(self):
        data = self.ask('hotels in ooty')
        self.assertEqual([s['name'] for s in data['stays']], ['Hill Top Stay'])
        self.assertIn('in Ooty', data['reply'])
        self.assertEqual([s['name'] for s in self.ask('cheap stays under 2000')['stays']], ['Lake View Inn'])
        self.assertEqual([s['name'] for s in self.ask('any place with a pool?')['stays']], ['Hill Top Stay'])
        self.assertEqual([s['name'] for s in self.ask('room for 4 people')['stays']], ['Hill Top Stay'])

    def test_live_availability(self):
        Booking.objects.create(organization=self.lake, room=self.lake_room, customer=self.guest,
                               check_in=self.tomorrow, check_out=self.tomorrow + timedelta(days=1),
                               status='CONFIRMED', total_amount=Decimal('1800'))
        data = self.ask('rooms free tomorrow')
        self.assertEqual([s['name'] for s in data['stays']], ['Hill Top Stay'])  # Lake View is full
        self.assertIn('rooms free', data['reply'])
        # On a property's page, the question is about that property.
        data = self.ask('is anything free tomorrow?', org_id=self.lake.id)
        self.assertIn('fully booked', data['reply'])
        data = self.ask('is a room free tomorrow?', org_id=self.hill.id)
        self.assertIn('Good news', data['reply'])
        self.assertEqual(data['actions'][0]['to'].split('?')[0], f'/book/{self.hill.id}')

    def test_my_bookings_needs_login(self):
        data = self.ask('show my bookings')
        self.assertIn('Log in', data['reply'])
        self.assertEqual(data['bookings'], [])
        Booking.objects.create(organization=self.hill, room=self.hill_room, customer=self.guest,
                               check_in=self.tomorrow, check_out=self.tomorrow + timedelta(days=2),
                               status='CONFIRMED', payment_method='AT_PROPERTY', total_amount=Decimal('6400'))
        data = self.ask('my bookings', user=self.guest)
        self.assertEqual(len(data['bookings']), 1)
        self.assertEqual((data['bookings'][0]['property'], data['bookings'][0]['balance_due']), ('Hill Top Stay', '6400.00'))
        # Another guest's booking is never shown.
        other = User.objects.create_user(username='o', email='o@example.com', password='x' * 12, role='CUSTOMER')
        self.assertEqual(self.ask('my bookings', user=other)['bookings'], [])

    def test_policies_and_contact_use_the_property_on_screen(self):
        self.assertIn('48 hours', self.ask('what is the cancellation policy', org_id=self.lake.id)['reply'])
        self.assertIn('check-in is from 02:00 PM', self.ask('what time is check in?', org_id=self.lake.id)['reply'])
        self.assertIn('+91 90000 00000', self.ask('contact number', org_id=self.hill.id)['reply'])
        self.assertIn('no booking fees', self.ask('how do I pay?')['reply'].lower())

    def test_greeting_and_validation(self):
        self.assertIn('assistant', self.ask('hello')['reply'])
        request = APIRequestFactory().post('/', {'message': '  '}, format='json')
        self.assertEqual(GuestAssistantView.as_view()(request).status_code, 400)


@override_settings(GUEST_ASSISTANT_LLM=True, GUEST_ASSISTANT_LLM_URL='http://llm', GUEST_ASSISTANT_MODEL='m',
                   GUEST_ASSISTANT_LLM_TIMEOUT=5)
class LlmFallbackTests(TestCase):
    def setUp(self):
        assistant._llm_down_until = 0.0
        o = Organization(schema_name='x', name='Sea Breeze', tenant_type='STP', org_type='ROOM_BOOKING', address='Beach Rd, Goa')
        o.auto_create_schema = False
        o.save()
        Room.objects.create(organization=o, name='1', price_per_night=Decimal('2000'), capacity=2)

    def ask(self, message):
        request = APIRequestFactory().post('/', {'message': message, 'history': [{'role': 'user', 'content': 'hi'}]}, format='json')
        return GuestAssistantView.as_view()(request).data

    def test_unrecognised_question_goes_to_llm_with_facts_only(self):
        resp = MagicMock()
        resp.json.return_value = {'message': {'content': 'Goa is lovely in winter.'}}
        with patch('apps.bookings.assistant.httpx.post', return_value=resp) as post:
            data = self.ask('is goa nice in december?')
        self.assertEqual((data['reply'], data['source']), ('Goa is lovely in winter.', 'ai'))
        sent = post.call_args.kwargs['json']
        self.assertEqual(sent['model'], 'm')
        self.assertIn('Sea Breeze (Goa): from ₹2,000/night', sent['messages'][0]['content'])
        self.assertEqual(sent['messages'][-1], {'role': 'user', 'content': 'is goa nice in december?'})

    def test_llm_down_falls_back_to_menu_and_backs_off(self):
        with patch('apps.bookings.assistant.httpx.post', side_effect=OSError('refused')) as post:
            first = self.ask('tell me a joke')
            second = self.ask('tell me another joke')
        self.assertEqual(first['source'], 'assistant')
        self.assertIn('I can find stays', first['reply'])
        self.assertEqual(post.call_count, 1)  # second question skips the dead LLM for a minute
        self.assertEqual(second['source'], 'assistant')
