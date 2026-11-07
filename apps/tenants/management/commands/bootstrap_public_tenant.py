"""
Ensures the public-schema tenant + its Domain row(s) exist.

django-tenants' TenantMainMiddleware routes purely by the HTTP Host header -
it needs a Domain row matching that exact hostname before it'll route *any*
request, tenant-scoped or not. With neither SHOW_PUBLIC_IF_NO_TENANT_FOUND
nor DEFAULT_NOT_FOUND_TENANT_VIEW configured, an unmatched hostname gets a
bare Http404 (which, since it never reaches a view, has no CORS headers
either - the browser reports that as a CORS error, not a 404).

Two different hostnames hit this in the Docker setup, and both need a row:
  - "localhost" (or PUBLIC_TENANT_DOMAIN in prod) - what the browser uses
  - "backend"                                     - what the orchestrator's
    server-to-server tool calls use (DJANGO_API_BASE_URL=http://backend:8000
    in docker-compose.yml/.prod.yml) - same Docker network, different Host
    header, so it needs its own Domain row even though it's the same server.

On a fresh database (no Organization/Domain rows yet - first `docker compose
up`, or any brand-new Postgres) every request 404s until these exist. Safe to
run repeatedly (get_or_create); called automatically from
docker/backend-entrypoint.sh on every container start.
"""
from django.core.management.base import BaseCommand

from apps.tenants.models import Domain, Organization


class Command(BaseCommand):
    help = "Idempotently creates the public-schema Organization + its Domain row(s)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--domain",
            action="append",
            dest="domains",
            default=None,
            help="Hostname to route to the public schema. Repeatable. Defaults to just 'localhost'.",
        )

    def handle(self, *args, **options):
        domain_names = options["domains"] or ["localhost"]

        org, org_created = Organization.objects.get_or_create(
            schema_name="public",
            defaults={"name": "Public", "tenant_type": "MSP"},
        )
        self.stdout.write(
            f"Organization 'public': {'created' if org_created else 'already existed'}"
        )

        for i, domain_name in enumerate(domain_names):
            domain, domain_created = Domain.objects.get_or_create(
                domain=domain_name,
                # First one listed is primary (used for reverse URL generation);
                # DomainMixin.save() keeps that unique across the tenant regardless.
                defaults={"tenant": org, "is_primary": i == 0},
            )
            self.stdout.write(
                f"Domain '{domain_name}': {'created' if domain_created else 'already existed'}"
            )
