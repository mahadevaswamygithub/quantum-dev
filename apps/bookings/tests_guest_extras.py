"""Guest wishlist and notifications."""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.bookings.guest_views import GuestNotificationsView, WishlistItemView, WishlistView
from apps.bookings.models import Booking, Room, WishlistItem
from apps.tenants.models import Organization
from apps.users.models import User


def call(view, user, method='get', data=None, **kwargs):
    request = getattr(APIRequestFactory(), method)('/', data or {}, format='json')
    if user:
        force_authenticate(request, user=user)
    return view(request, **kwargs)


class GuestExtrasTests(TestCase):
    def setUp(self):
        self.org = Organization(schema_name='w', name='Lake Inn', tenant_type='STP', org_type='ROOM_BOOKING')
        self.org.auto_create_schema = False
        self.org.save()
        self.room = Room.objects.create(organization=self.org, name='101', price_per_night=Decimal('1500'))
        self.guest = User.objects.create_user(username='g', email='g@x.com', password='x' * 12, role='CUSTOMER')
        self.staff = User.objects.create_user(username='s', email='s@x.com', password='x' * 12, role='STP_ADMIN', organization=self.org)

    def test_wishlist_add_list_remove(self):
        self.assertEqual(call(WishlistView.as_view(), self.staff).status_code, 403)   # guests only
        self.assertEqual(call(WishlistView.as_view(), None).status_code, 401)
        self.assertEqual(call(WishlistView.as_view(), self.guest, 'post', {'organization': 999}).status_code, 400)
        self.assertEqual(call(WishlistView.as_view(), self.guest, 'post', {'organization': self.org.id}).status_code, 201)
        call(WishlistView.as_view(), self.guest, 'post', {'organization': self.org.id})              # idempotent
        data = call(WishlistView.as_view(), self.guest).data
        self.assertEqual((data['ids'], [s['name'] for s in data['stays']]), ([self.org.id], ['Lake Inn']))
        self.assertEqual(call(WishlistItemView.as_view(), self.guest, 'delete', org_id=self.org.id).status_code, 204)
        self.assertFalse(WishlistItem.objects.exists())

    def test_notifications_from_booking_state(self):
        tomorrow = date.today() + timedelta(days=1)
        mk = lambda **kw: Booking.objects.create(organization=self.org, room=self.room, customer=self.guest,  # noqa: E731
                                                 check_in=tomorrow, check_out=tomorrow + timedelta(days=1),
                                                 total_amount=Decimal('1500'), **kw)
        mk(status='CONFIRMED', payment_method='AT_PROPERTY')
        mk(status='PENDING', payment_method='AT_PROPERTY')
        mk(status='CONFIRMED', payment_method='AT_PROPERTY', cancel_request_status='DECLINED', cancel_request_reply='Non-refundable rate')
        mk(status='CANCELLED', cancel_request_status='APPROVED', cancelled_at=timezone.now())
        other = User.objects.create_user(username='o', email='o@x.com', password='x' * 12, role='CUSTOMER')
        Booking.objects.create(organization=self.org, room=self.room, customer=other, check_in=tomorrow,
                               check_out=tomorrow + timedelta(days=1), total_amount=Decimal('1500'), status='CONFIRMED')

        items = call(GuestNotificationsView.as_view(), self.guest).data
        kinds = sorted(i['kind'] for i in items)
        self.assertIn('awaiting', kinds)
        self.assertIn('cancel_declined', kinds)
        self.assertIn('cancel_approved', kinds)
        self.assertIn('check_in_soon', kinds)
        self.assertEqual(kinds.count('confirmed'), 2)
        declined = next(i for i in items if i['kind'] == 'cancel_declined')
        self.assertEqual(declined['body'], 'Non-refundable rate')
        self.assertEqual(len({i['id'] for i in items}), len(items))                     # stable unique ids
        self.assertEqual(call(GuestNotificationsView.as_view(), other).data[0]['kind'] in ('confirmed', 'check_in_soon'), True)
