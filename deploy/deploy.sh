#!/usr/bin/env bash
# Run from the extracted project on a Linux host with Docker Compose v2.
set -euo pipefail
cd "$(dirname "$0")/.."
test -f .env || { echo 'Create .env from .env.example and set server secrets first.' >&2; exit 1; }
chmod 600 .env
docker compose config --quiet
docker compose build
# setup runs migration and inserts only missing, disabled source candidates.
docker compose up -d db
docker compose run --rm setup
docker compose --profile https up -d api worker web caddy
for attempt in {1..30}; do
  if docker compose exec -T web node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then
    docker compose exec -T web node scripts/smoke.ts --base http://127.0.0.1:3000
    echo 'Internal smoke passed. Verify the external HTTPS authentication and complete docs/operations-zh.md before public launch.'
    exit 0
  fi
  sleep 2
done
echo 'Health check failed. Inspect docker compose logs; existing volumes have been preserved.' >&2
exit 1
