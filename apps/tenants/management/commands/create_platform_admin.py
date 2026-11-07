"""Create a platform owner (CoreX) account: sees every customer, approves
sign-ups, suspends accounts, sets hotel limits.

    python manage.py create_platform_admin --email you@corex.com --first-name Asha --last-name Rao

The account belongs to the "public" organization and gets an email link to
set its password (two-step verification is required at first sign-in, see
TWO_FACTOR_REQUIRED_ROLES). Pass --print-link to also print the link, for a
server without email set up.
"""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.management.base import BaseCommand, CommandError
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.tenants.models import Organization
from apps.tenants.onboarding import unique_username
from apps.users.models import User
from apps.users.serializers.users import send_invite_email


class Command(BaseCommand):
    help = 'Create a platform owner account (role PLATFORM_ADMIN).'

    def add_arguments(self, parser):
        parser.add_argument('--email', required=True)
        parser.add_argument('--first-name', required=True)
        parser.add_argument('--last-name', default='')
        parser.add_argument('--print-link', action='store_true', help='Also print the set-password link.')

    def handle(self, *args, **opts):
        email = opts['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f'A user with {email} already exists.')
        public = Organization.objects.filter(schema_name='public').first()
        if not public:
            raise CommandError('No public organization yet. Run: python manage.py bootstrap_public_tenant')
        user = User.objects.create_user(
            username=unique_username(email), email=email, first_name=opts['first_name'],
            last_name=opts['last_name'], password=None, organization=public, role='PLATFORM_ADMIN',
        )
        sent = send_invite_email(user)
        self.stdout.write(self.style.SUCCESS(f'Platform admin {email} created.'))
        self.stdout.write('Set-password email ' + ('sent.' if sent else 'NOT sent (check the email settings).'))
        if opts['print_link'] or not sent:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            self.stdout.write(f'Set-password link: {settings.FRONTEND_URL}/reset-password/{uid}/{token}')
