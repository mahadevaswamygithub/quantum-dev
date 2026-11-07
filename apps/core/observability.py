"""Request IDs and log formatting.

Every request gets an ID (taken from an incoming X-Request-ID header set by
the load balancer, or generated) that is:
- returned in the X-Request-ID response header (quote it in support tickets),
- added to every log line written while handling that request,
- attached to Sentry events when Sentry is on.
"""
import contextvars
import json
import logging
import re
import time
import uuid

_request_id = contextvars.ContextVar('request_id', default='-')
_SAFE = re.compile(r'^[A-Za-z0-9._-]{8,64}$')
access_log = logging.getLogger('corex.access')


def current_request_id():
    return _request_id.get()


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get('X-Request-ID', '')
        rid = incoming if _SAFE.match(incoming) else uuid.uuid4().hex
        token = _request_id.set(rid)
        request.request_id = rid
        started = time.monotonic()
        try:
            try:
                import sentry_sdk
                sentry_sdk.set_tag('request_id', rid)
            except ImportError:
                pass
            response = self.get_response(request)
            response['X-Request-ID'] = rid
            if not request.path.startswith(('/api/health', '/static/', '/media/')):
                access_log.info('%s %s %s %.0fms', request.method, request.path, response.status_code,
                                (time.monotonic() - started) * 1000)
            return response
        finally:
            _request_id.reset(token)


class RequestIDFilter(logging.Filter):
    """Adds `request_id` to every log record."""

    def filter(self, record):
        record.request_id = _request_id.get()
        return True


class JSONFormatter(logging.Formatter):
    """One JSON object per line — easy to ship to CloudWatch, Loki, ELK, etc."""

    def format(self, record):
        data = {
            'time': self.formatTime(record, '%Y-%m-%dT%H:%M:%S'),
            'level': record.levelname,
            'logger': record.name,
            'request_id': getattr(record, 'request_id', '-'),
            'message': record.getMessage(),
        }
        if record.exc_info:
            data['exception'] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)
