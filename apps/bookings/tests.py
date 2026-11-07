from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from django.test import SimpleTestCase
from django.utils import timezone
from apps.bookings.serializers import (
    BookingCreateSerializer,
    PropertySerializer,
    RoomSerializer,
    BookingSerializer,
)
from apps.bookings.models import Room, Property, Booking


class BookingSerializerTests(SimpleTestCase):
    def test_booking_nights_calculated_correctly(self):
        booking = MagicMock(spec=Booking)
        booking.check_in = date(2026, 12, 1)
        booking.check_out = date(2026, 12, 5)
        serializer = BookingSerializer()
        self.assertEqual(serializer.get_nights(booking), 4)


class BookingCreateSerializerValidationTests(SimpleTestCase):
    def setUp(self):
        self.room = MagicMock(spec=Room)
        self.room.id = 1
        self.room.is_active = True
        self.room.capacity = 2

    def test_rejects_check_out_before_or_same_as_check_in(self):
        today = timezone.now().date() + timedelta(days=2)
        data = {
            'room': self.room,
            'check_in': today,
            'check_out': today,
            'guests': 1,
        }
        serializer = BookingCreateSerializer()
        with self.assertRaises(Exception) as ctx:
            serializer.validate(data)
        self.assertIn('check_out', str(ctx.exception))
        self.assertIn('Check-out must be after check-in', str(ctx.exception))

    def test_rejects_past_check_in(self):
        past_date = timezone.now().date() - timedelta(days=1)
        data = {
            'room': self.room,
            'check_in': past_date,
            'check_out': past_date + timedelta(days=2),
            'guests': 1,
        }
        serializer = BookingCreateSerializer()
        with self.assertRaises(Exception) as ctx:
            serializer.validate(data)
        self.assertIn('check_in', str(ctx.exception))
        self.assertIn('Check-in cannot be in the past', str(ctx.exception))

    def test_rejects_inactive_room(self):
        self.room.is_active = False
        today = timezone.now().date() + timedelta(days=2)
        data = {
            'room': self.room,
            'check_in': today,
            'check_out': today + timedelta(days=2),
            'guests': 1,
        }
        serializer = BookingCreateSerializer()
        with self.assertRaises(Exception) as ctx:
            serializer.validate(data)
        self.assertIn('room', str(ctx.exception))
        self.assertIn('not available for booking', str(ctx.exception))

    def test_rejects_guests_exceeding_capacity(self):
        self.room.capacity = 2
        today = timezone.now().date() + timedelta(days=2)
        data = {
            'room': self.room,
            'check_in': today,
            'check_out': today + timedelta(days=2),
            'guests': 4,
        }
        serializer = BookingCreateSerializer()
        with self.assertRaises(Exception) as ctx:
            serializer.validate(data)
        self.assertIn('guests', str(ctx.exception))
        self.assertIn('sleeps at most 2 guest(s)', str(ctx.exception))

    @patch.object(Booking, 'blocking_bookings')
    def test_rejects_when_room_not_available(self, mock_blocking):
        mock_blocking.return_value.exists.return_value = True
        today = timezone.now().date() + timedelta(days=2)
        data = {
            'room': self.room,
            'check_in': today,
            'check_out': today + timedelta(days=2),
            'guests': 1,
        }
        serializer = BookingCreateSerializer()
        with self.assertRaises(Exception) as ctx:
            serializer.validate(data)
        self.assertIn('room', str(ctx.exception))
        self.assertIn('already booked', str(ctx.exception))


class PropertyAndRoomSerializerTests(SimpleTestCase):
    def test_property_requires_room_booking_org_type(self):
        org = MagicMock()
        org.org_type = 'HOSPITAL'  # Not ROOM_BOOKING
        serializer = PropertySerializer(context={'organization': org})
        with self.assertRaises(Exception) as ctx:
            serializer.validate({})
        self.assertIn('Properties can only belong to a Room Booking organization', str(ctx.exception))

    def test_room_property_must_belong_to_same_organization(self):
        org = MagicMock()
        org.id = 10
        org.org_type = 'ROOM_BOOKING'

        diff_prop = MagicMock(spec=Property)
        diff_prop.organization_id = 99  # Different organization

        serializer = RoomSerializer(context={'organization': org})
        with self.assertRaises(Exception) as ctx:
            serializer.validate({'property': diff_prop})
        self.assertIn("This property doesn't belong to your organization", str(ctx.exception))


class BookingSettingsTests(SimpleTestCase):
    def test_check_out_must_be_earlier_in_day_than_check_in(self):
        from apps.bookings.serializers import BookingSettingsSerializer
        serializer = BookingSettingsSerializer(data={'check_in_time': '12:00', 'check_out_time': '14:00'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('check_out_time', serializer.errors)

    def test_valid_times_accepted(self):
        from apps.bookings.serializers import BookingSettingsSerializer
        serializer = BookingSettingsSerializer(data={'check_in_time': '14:00', 'check_out_time': '11:00'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_only_stp_admin_can_change_booking_settings(self):
        from unittest.mock import MagicMock
        from rest_framework.test import APIRequestFactory, force_authenticate
        from apps.bookings.views import BookingSettingsView
        org = MagicMock(org_type='ROOM_BOOKING')
        for role in ('STP_USER', 'CUSTOMER', 'EMPLOYEE', 'MSP_ADMIN'):
            with self.subTest(role=role):
                user = MagicMock(role=role, organization=org, is_authenticated=True)
                request = APIRequestFactory().patch('/bookings/settings/', {'accepting_bookings': False}, format='json')
                force_authenticate(request, user=user)
                self.assertEqual(BookingSettingsView.as_view()(request).status_code, 403)
