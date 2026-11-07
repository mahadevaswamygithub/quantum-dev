# CoreX on Kubernetes

Plain manifests organised with Kustomize (built into `kubectl`, no Helm needed).

```
k8s/
  base/                 shared by every environment
  overlays/production/  managed Postgres, S3, HTTPS ingress, autoscaling
  overlays/local/       Docker Desktop: Postgres in the cluster, one copy of everything
  deploy.sh             migrate + apply + wait for rollout
```

## What runs

| Workload | Kind | Copies | Notes |
|---|---|---|---|
| `frontend` | Deployment | 2-6 (HPA) | nginx: React build, proxies `/api` and `/media` to the backend. The only thing the Ingress exposes. |
| `backend` | Deployment | 2-10 (HPA) | Django + gunicorn. Probes: `/api/health/` (alive) and `/api/health/ready/` (database, Redis, storage). |
| `celery-worker` | Deployment | 1-4 (HPA) | Booking emails with retries, background jobs. |
| `celery-beat` | Deployment | exactly 1 | Periodic jobs. Never scale it: two would run every job twice. |
| `orchestrator` | Deployment | 1 | FastAPI AI chat. Internal only: a NetworkPolicy lets only the backend call it. |
| `redis` | StatefulSet | 1 | Cache, Celery queue, chat memory. Swap for managed Redis at scale. |
| `corex-migrate` | Job | once per release | `migrate_schemas` + tenant Domain rows. Backend and Celery pods wait for it before starting. |

Postgres is **not** in the production overlay on purpose: use a managed
database (RDS, Cloud SQL, Azure Database for PostgreSQL) with automated backups
and point-in-time recovery. Uploads go to S3 (or R2, Wasabi, MinIO), so backend
pods hold no data and can be replaced or scaled freely.

## Production

What the cluster needs: **ingress-nginx**, **cert-manager** with a
`letsencrypt-prod` ClusterIssuer, **metrics-server** (for autoscaling) and a
network plugin that enforces NetworkPolicy (Calico, Cilium, or your cloud's
add-on). EKS, GKE and AKS all work.

1. **Images.** `.github/workflows/images.yml` builds and pushes
   `ghcr.io/<owner>/corex-backend|frontend|orchestrator` on every push to
   `master`, tagged with the commit SHA. If the packages are private, give the
   cluster a pull secret.
2. **Settings.** In `overlays/production/kustomization.yaml` set your domain
   (`ALLOWED_HOSTS`, `PUBLIC_TENANT_DOMAIN`, `FRONTEND_URL`,
   `CORS_ALLOWED_ORIGINS`) and the image tags (use the commit SHA, not
   `latest`, so a rollback is just the previous SHA). Put the same domain in
   `ingress.yaml`.
3. **Secrets.** Copy `secrets/backend.env.example` to `secrets/backend.env` and
   `secrets/orchestrator.env.example` to `secrets/orchestrator.env`, then fill
   them in. Git ignores the real files. For large customers, prefer a secret
   manager (External Secrets Operator, Sealed Secrets, SOPS) that creates
   Secrets named `corex-secrets` and `orchestrator-secrets`.
4. **Deploy** (Git Bash, Linux, macOS or CI):
   ```bash
   k8s/deploy.sh k8s/overlays/production
   ```
   It deletes the previous migrate Job (Jobs can't be updated in place), applies
   everything, waits for the migrations and then for every rollout. Rolling
   updates keep the old pods serving until the new ones are ready.
5. **Check.**
   ```bash
   kubectl -n corex get pods
   kubectl -n corex logs deploy/backend --tail=50     # JSON lines with request_id
   curl https://<your-domain>/api/health/ready/
   ```

6. **Platform owner account** (first deploy only): creates the account that
   approves and manages customers at `/platform`.
   ```bash
   kubectl -n corex exec deploy/backend -- \
     python manage.py create_platform_admin --email ops@your-domain.com --first-name Ops --last-name Team
   ```
   It emails a set-password link (`--print-link` also prints it). See
   "Production quick start" in the [root README](../README.md).

**Rollback:** set the previous image tag and run `deploy.sh` again, or
`kubectl -n corex rollout undo deployment/backend`. Migrations don't roll back
by themselves, so keep them backwards compatible (add columns first, remove
them in a later release).

**Namespace:** everything lives in `corex`. If you change it, also change
`BACKEND_UPSTREAM` in `base/frontend.yaml` (nginx needs the full service name).

**Client IPs** (rate limits, login lockout): `TRUSTED_PROXY_COUNT=2` is set for
ingress, then the frontend's nginx. If a cloud load balancer sits in front of
the ingress, set the ingress Service to `externalTrafficPolicy: Local` (or turn
on the proxy protocol) so the real client IP reaches the ingress.

## Try it locally (Docker Desktop)

Enable Kubernetes in Docker Desktop (Settings > Kubernetes), then:

```bash
docker build --target prod -t corex-backend:local .
docker build --target prod -t corex-frontend:local corex-rct
docker build --target prod -t corex-orchestrator:local orchestrator
kubectl config use-context docker-desktop
k8s/deploy.sh k8s/overlays/local
kubectl -n corex port-forward svc/frontend 8080:80
```

Open http://localhost:8080. The local overlay keeps uploads in a scratch folder
without S3, so uploaded photos don't display and disappear on restart. Point
`USE_S3`/`S3_*` at a test bucket if you need them. The AI chat uses Ollama on
your machine (`host.docker.internal:11434`).

Remove everything: `kubectl delete namespace corex`.
