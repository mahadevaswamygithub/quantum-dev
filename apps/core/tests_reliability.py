"""Production plumbing: health checks, request IDs, email queueing, deploy checks, S3 config."""
import logging
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from apps.bookings import notifications
from apps.bookings.models import Booking, Room
from apps.bookings.tasks import send_booking_email
from apps.core.checks import production_readiness
from apps.core.health import liveness, readiness
from apps.core.observability import JSONFormatter, RequestIDFilter, RequestIDMiddleware, current_request_id
from apps.tenants.models import Organization
from apps.users.models import User


class HealthAndRequestIdTests(TestCase):
    def test_health_endpoints(self):
        rf = RequestFactory()
        self.assertEqual(liveness(rf.get('/api/health/')).status_code, 200)
        r = readiness(rf.get('/api/health/ready/'))
        self.assertEqual(r.status_code, 200)
        with patch('apps.core.health._database', side_effect=OSError('db down')):
            r = readiness(rf.get('/api/health/ready/'))
        self.assertEqual(r.status_code, 503)
        self.assertIn(b'"database": {"ok": false', r.content)

    def test_request_id_header_logs_and_reuse(self):
        seen = {}

        def view(request):
            seen['rid'] = current_request_id()
            from django.http import HttpResponse
            return HttpResponse('ok')
        mw = RequestIDMiddleware(view)
        r = mw(RequestFactory().get('/api/x'))
        self.assertEqual(r['X-Request-ID'], seen['rid'])
        self.assertEqual(len(seen['rid']), 32)
        r = mw(RequestFactory().get('/api/x', HTTP_X_REQUEST_ID='lb-trace-12345678'))   # from the load balancer
        self.assertEqual(r['X-Request-ID'], 'lb-trace-12345678')
        r = mw(RequestFactory().get('/api/x', HTTP_X_REQUEST_ID='bad id; drop table'))  # unsafe: replaced
        self.assertNotIn(' ', r['X-Request-ID'])
        self.assertEqual(current_request_id(), '-')                                     # reset after the request

        record = logging.LogRecord('corex', logging.INFO, __file__, 1, 'hello %s', ('world',), None)
        RequestIDFilter().filter(record)
        self.assertIn('"message": "hello world"', JSONFormatter().format(record))


class DeployCheckTests(SimpleTestCase):
    @override_settings(USE_S3=False, BOOKING_EMAILS_VIA_CELERY=False, SENTRY_DSN='',
                       CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
    def test_flags_unsafe_production_settings(self):
        self.assertEqual(sorted(w.id for w in production_readiness(None)), ['corex.W001', 'corex.W002', 'corex.W003', 'corex.W004'])

    @override_settings(USE_S3=True, BOOKING_EMAILS_VIA_CELERY=True, SENTRY_DSN='https://k@sentry.example/1',
                       CACHES={'default': {'BACKEND': 'django.core.cache.backends.redis.RedisCache', 'LOCATION': 'redis://x'}})
    def test_quiet_when_production_ready(self):
        self.assertEqual(production_readiness(None), [])

    def test_s3_storage_backend_builds(self):
        from storages.backends.s3 import S3Storage
        storage = S3Storage(bucket_name='corex-test', endpoint_url='https://s3.example.com', access_key='k', secret_key='s',
                            location='media', file_overwrite=False, querystring_auth=False)
        self.assertEqual(storage.url('room_images/a.jpg'), 'https://s3.example.com/corex-test/media/room_images/a.jpg')


class BookingEmailQueueTests(TestCase):
    def setUp(self):
        org = Organization(schema_name='q', name='Queue Inn', tenant_type='STP', org_type='ROOM_BOOKING')
        org.auto_create_schema = False
        org.save()
        room = Room.objects.create(organization=org, name='1', price_per_night=Decimal('1000'))
        guest = User.objects.create_user(username='g', email='g@x.com', password='x' * 12, role='CUSTOMER', first_name='G')
        self.booking = Booking.objects.create(organization=org, room=room, customer=guest, guest_email='g@x.com',
                                              check_in=date.today() + timedelta(days=5), check_out=date.today() + timedelta(days=6),
                                              status='CONFIRMED', total_amount=Decimal('1000'))

    @override_settings(BOOKING_EMAILS_ASYNC=True, BOOKING_EMAILS_VIA_CELERY=True)
    def test_queued_on_celery_after_commit(self):
        with patch('apps.bookings.tasks.send_booking_email.delay') as delay, self.captureOnCommitCallbacks(execute=True):
            notifications.notify(self.booking, 'confirmed')
        delay.assert_called_once_with(self.booking.id, 'confirmed')

    @override_settings(BOOKING_EMAILS_ASYNC=True, BOOKING_EMAILS_VIA_CELERY=True)
    def test_broker_down_falls_back_to_thread(self):
        with patch('apps.bookings.tasks.send_booking_email.delay', side_effect=ConnectionError('redis down')), \
             patch('apps.bookings.notifications.threading.Thread') as thread, self.captureOnCommitCallbacks(execute=True):
            notifications.notify(self.booking, 'confirmed')
        thread.assert_called_once()
        self.assertEqual(thread.call_args.kwargs['args'], (self.booking.id, 'confirmed'))

    def test_task_sends_and_retries_on_failure(self):
        send_booking_email.apply(args=(self.booking.id, 'confirmed'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('confirmed', mail.outbox[0].subject)
        self.assertIn(Exception, send_booking_email.autoretry_for)
        self.assertEqual(send_booking_email.max_retries, 6)
        with patch('apps.bookings.notifications.send_org_email', side_effect=OSError('smtp down')):
            result = send_booking_email.apply(args=(self.booking.id, 'confirmed'), throw=False)
        self.assertTrue(result.failed() or result.status == 'RETRY')
        send_booking_email.apply(args=(999999, 'confirmed'))   # booking gone: no error, nothing sent
        self.assertEqual(len(mail.outbox), 1)
