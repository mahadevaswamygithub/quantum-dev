#!/usr/bin/env bash
# Deploy (or upgrade) CoreX on Kubernetes.
#   k8s/deploy.sh                          # production overlay
#   k8s/deploy.sh k8s/overlays/local       # Docker Desktop
#
# 1. removes the previous migrate Job (Jobs can't be updated in place)
# 2. applies everything; new backend/Celery pods wait for the migrations
# 3. waits for the migrate Job, then for every rollout
set -euo pipefail

OVERLAY="${1:-k8s/overlays/production}"
NS="${NAMESPACE:-corex}"

if [ -d "$OVERLAY/secrets" ]; then
  for f in "$OVERLAY"/secrets/*.env.example; do
    real="${f%.example}"
    [ -f "$real" ] || { echo "Missing $real (copy it from $f and fill it in)"; exit 1; }
  done
fi

kubectl -n "$NS" delete job corex-migrate --ignore-not-found
kubectl apply -k "$OVERLAY"

echo "Waiting for migrations..."
for _ in $(seq 1 180); do
  ok=$(kubectl -n "$NS" get job corex-migrate -o jsonpath='{.status.succeeded}' 2>/dev/null || true)
  failed=$(kubectl -n "$NS" get job corex-migrate -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}' 2>/dev/null || true)
  if [ "$ok" = "1" ]; then echo "Migrations done."; break; fi
  if [ "$failed" = "True" ]; then
    echo "Migrations FAILED:"; kubectl -n "$NS" logs job/corex-migrate --tail=50 || true; exit 1
  fi
  sleep 5
done
[ "${ok:-}" = "1" ] || { echo "Timed out waiting for migrations"; exit 1; }

for d in backend celery-worker celery-beat orchestrator frontend; do
  kubectl -n "$NS" rollout status "deployment/$d" --timeout=10m
done
echo "CoreX is up."
