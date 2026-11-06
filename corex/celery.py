import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'corex.settings')

app = Celery('corex')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
