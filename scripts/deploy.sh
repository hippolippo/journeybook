#!/usr/bin/env bash
#
# Journeybook deploy — runs on the host. Pulls prebuilt images and swaps the
# stack, taking a snapshot of pb_data first so a redeploy can never lose
# memories. Called by .github/workflows/deploy.yml.
#
# Credentials: the PocketBase superuser email and password are read from stdin
# as two lines (email, then password) and never touch argv or the process list.
#
# Config comes from docker/.env (DOMAIN, APP_BASE) plus:
#   IMAGE_TAG   tag of the images to deploy, e.g. the commit SHA   [required]
#   WEB_IMAGE   web image repo   [default: ghcr.io/hippolippo/journeybook-web]
#   PB_IMAGE    pb image repo    [default: ghcr.io/hippolippo/journeybook-pb]
#   BACKUP_KEEP on-box snapshots to retain                         [default: 10]
set -euo pipefail

cd "$(dirname "$0")/.."
repo_root="$PWD"

log() { printf '[deploy] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# shellcheck disable=SC1091
if [ -f docker/.env ]; then set -a && . docker/.env && set +a; fi

: "${IMAGE_TAG:?set IMAGE_TAG to the image tag to deploy (e.g. the commit SHA)}"
WEB_IMAGE="${WEB_IMAGE:-ghcr.io/hippolippo/journeybook-web}:${IMAGE_TAG}"
PB_IMAGE="${PB_IMAGE:-ghcr.io/hippolippo/journeybook-pb}:${IMAGE_TAG}"
DOMAIN="${DOMAIN:-localhost}"
APP_BASE="${APP_BASE:-/journeybook}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
export WEB_IMAGE PB_IMAGE DOMAIN APP_BASE

compose() { docker compose --env-file docker/.env "$@"; }

creds_file="$(mktemp)"
chmod 600 "$creds_file"
cleanup() { rm -f "$creds_file"; }
trap cleanup EXIT

admin_email=""
admin_password=""
if [ ! -t 0 ]; then
  IFS= read -r admin_email || true
  IFS= read -r admin_password || true
fi
[ -n "$admin_email" ] || die "no admin email on stdin"
[ -n "$admin_password" ] || die "no admin password on stdin"
printf '%s\n%s\n' "$admin_email" "$admin_password" > "$creds_file"

mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
snapshot="pb_data-${stamp}.tar.gz"

# 1. Stop the stack so the database is quiescent for a clean snapshot.
log "stopping stack"
compose down --remove-orphans

# 2. Back up the live data — always, before anything is replaced.
log "backing up pb_data -> backups/$snapshot"
docker run --rm \
  -v journeybook_pb_data:/data:ro \
  -v "$repo_root/backups:/backup" \
  alpine:3.20 tar czf "/backup/$snapshot" -C /data . \
  || die "backup failed — aborting deploy"

# 3. Fetch the new images.
log "pulling images ($IMAGE_TAG)"
compose pull

# 4. Upsert the superuser so the admin is exactly the configured credentials.
log "upserting superuser $admin_email"
compose run --rm --no-deps -T --entrypoint sh pb -c \
  'IFS= read -r e; IFS= read -r p; /pb/pocketbase superuser upsert "$e" "$p"' < "$creds_file"

# 5. Start the new stack and wait for health.
log "starting stack"
compose up -d --no-build --wait --wait-timeout 120

# 6. Retain only the newest snapshots.
# shellcheck disable=SC2012
ls -1t backups/pb_data-*.tar.gz 2>/dev/null | tail -n "+$((BACKUP_KEEP + 1))" | while read -r old; do
  log "pruning $old"
  rm -f "$old"
done

# 7. Verify the public API through Caddy.
log "verifying https://${DOMAIN}${APP_BASE}/api/health"
for _ in $(seq 1 30); do
  if curl -fsSk --resolve "${DOMAIN}:443:127.0.0.1" \
    "https://${DOMAIN}${APP_BASE}/api/health" >/dev/null; then
    log "healthy"
    exit 0
  fi
  sleep 2
done
die "health check failed"
