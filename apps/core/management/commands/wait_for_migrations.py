"""Block until the database has every migration this code ships.

Kubernetes runs this as an init container on the backend and Celery pods, so a
new version only starts serving after the migrate Job has finished. Without it
new pods could take traffic while their tables or columns don't exist yet.

    python manage.py wait_for_migrations --timeout 900
"""
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


def pending_migrations():
    executor = MigrationExecutor(connection)
    return executor.migration_plan(executor.loader.graph.leaf_nodes())


class Command(BaseCommand):
    help = 'Wait until all migrations are applied (used by Kubernetes init containers).'

    def add_arguments(self, parser):
        parser.add_argument('--timeout', type=int, default=900, help='Seconds to wait before failing.')
        parser.add_argument('--interval', type=float, default=3.0, help='Seconds between checks.')

    def handle(self, *args, **options):
        deadline = time.monotonic() + options['timeout']
        last = None
        while True:
            try:
                plan = pending_migrations()
                if not plan:
                    self.stdout.write('Migrations are up to date.')
                    return
                last = f'{len(plan)} migration(s) not applied yet, e.g. {plan[0][0]}'
            except Exception as exc:  # database not reachable yet
                last = f'database not ready ({exc.__class__.__name__})'
                connection.close()
            if time.monotonic() >= deadline:
                raise CommandError(f'Gave up waiting for migrations: {last}')
            self.stdout.write(f'Waiting: {last}')
            time.sleep(options['interval'])
