#!/usr/bin/env bash
# Restore the private initial content snapshot into a NEW, empty Compose database.
# Usage: bash deploy/import-launch-content.sh /private/path/ai-signal-jp-content-20261004.dump
set -euo pipefail
cd "$(dirname "$0")/.."
dump_dir=$(cd "$(dirname "${1:?Pass the absolute path to the private content dump}")" && pwd -P)
dump_name=$(basename "$1")
test -f "$dump_dir/$dump_name"
test -f "$dump_dir/$dump_name.sha256"
(cd "$dump_dir" && sha256sum --check "$dump_name.sha256")
test -f .env || { echo 'Create .env and set new server secrets before restoring.' >&2; exit 1; }
chmod 600 .env
docker compose config --quiet
docker compose build
docker compose up -d --wait db
tables=$(docker compose exec -T db psql -v ON_ERROR_STOP=1 -U aihot -d aihot -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p')")
test "$tables" = 0 || { echo 'Refusing restore: target database already has tables. Use a new deployment directory/project and new volumes.' >&2; exit 1; }
docker compose exec -T db pg_restore --exit-on-error --no-owner --no-privileges -U aihot -d aihot < "$dump_dir/$dump_name"
docker compose run --rm setup
echo 'Initial content restored. Local admin sessions/users were excluded; configure new server secrets before starting services.'
echo 'Continue with deploy/deploy.sh in restricted mode and docs/operations-zh.md.'
