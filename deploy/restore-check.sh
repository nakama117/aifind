#!/usr/bin/env bash
# Restores a matching .dump / -files-.tar.gz pair into NEW containers/volumes.
# Never replaces the site's live db/data volumes. Usage: bash deploy/restore-check.sh /absolute/path/to/backup-pair
set -euo pipefail
cd "$(dirname "$0")/.."
backup_dir=$(cd "${1:?Pass the directory containing exactly one matching backup pair}" && pwd -P)
shopt -s nullglob
dumps=("$backup_dir"/*.dump)
test "${#dumps[@]}" -eq 1 || { echo 'Expect exactly one .dump in the directory.' >&2; exit 1; }
dump=$(basename "${dumps[0]}")
stamp=${dump%.dump}; stamp=${stamp##*-}
db_name=${dump%-*}
files="$db_name-files-$stamp.tar.gz"
test -f "$backup_dir/$files"
# Names are generated here, never received from an untrusted archive or reused from production.
restore_id="aisignal-restore-$(date +%Y%m%d%H%M%S)-$$"
db_volume="$restore_id-db"
data_volume="$restore_id-data"
password=$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')
docker volume create "$db_volume" >/dev/null
docker volume create "$data_volume" >/dev/null
docker run -d --name "$restore_id" --network none -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=restore_check \
  -v "$db_volume:/var/lib/postgresql/data" -v "$backup_dir:/backup:ro" -v "$data_volume:/restore-data" postgres:17-alpine >/dev/null
trap 'docker stop "$restore_id" >/dev/null 2>&1 || true; echo "Restore container stopped. Audit volumes retained: $db_volume and $data_volume"' EXIT
ready=false
for attempt in {1..30}; do
  # The image's temporary initialization server only accepts Unix sockets. Wait for the final TCP server.
  if docker exec "$restore_id" pg_isready -h 127.0.0.1 -U postgres -d restore_check >/dev/null; then ready=true; break; fi
  sleep 2
done
test "$ready" = true || { echo 'Restore database did not become ready; no restore attempted.' >&2; exit 1; }
docker exec "$restore_id" pg_restore --exit-on-error --no-owner -U postgres -d restore_check "/backup/$dump"
# Reject paths outside the two application-owned directories before extraction.
docker exec "$restore_id" tar -tzf "/backup/$files" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ || ($0 !~ /^(uploads|feedback-screenshots)(\/|$)/) { bad=1 }
  END { exit bad }'
# The backup producer only archives trusted application files. Untrusted archives require separate review.
docker exec "$restore_id" tar -xzf "/backup/$files" -C /restore-data
docker exec "$restore_id" psql -v ON_ERROR_STOP=1 -U postgres -d restore_check -c 'SELECT count(*) AS publications FROM publications; SELECT count(*) AS migrations FROM schema_migrations;'
docker exec "$restore_id" sh -c 'find /restore-data -type f | wc -l'
echo "PASS: paired backup restored to isolated volumes. Confirm expected counts and SHA-256 against backup.last. Production was not modified."
