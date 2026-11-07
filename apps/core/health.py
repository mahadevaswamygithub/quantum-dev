"""Health checks for load balancers, Docker and uptime monitors.

GET /api/health/        liveness  — the process is up (no dependencies touched)
GET /api/health/ready/  readiness — database, cache/Redis and file storage work;
                        503 if any of them doesn't, so the load balancer stops
                        sending traffic to this server.
"""
import time

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse


def liveness(request):
    return JsonResponse({'status': 'ok'})


def _check(fn):
    started = time.monotonic()
    try:
        fn()
        return {'ok': True, 'ms': round((time.monotonic() - started) * 1000)}
    except Exception as exc:  # report, don't crash the probe
        return {'ok': False, 'error': exc.__class__.__name__}


def _database():
    with connection.cursor() as cur:
        cur.execute('SELECT 1')
        cur.fetchone()


def _cache():
    cache.set('health:ping', '1', 10)
    if cache.get('health:ping') != '1':
        raise RuntimeError('cache read-back failed')


def _storage():
    from django.core.files.storage import default_storage
    default_storage.exists('health-check-probe')  # a cheap round-trip (local disk or S3)


def readiness(request):
    checks = {'database': _check(_database), 'cache': _check(_cache), 'storage': _check(_storage)}
    ok = all(c['ok'] for c in checks.values())
    return JsonResponse(
        {'status': 'ok' if ok else 'degraded', 'checks': checks,
         'cache_backend': 'redis' if 'redis' in settings.CACHES['default']['BACKEND'].lower() else 'local-memory'},
        status=200 if ok else 503,
    )
