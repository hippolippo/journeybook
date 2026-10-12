#!/usr/bin/env bash
#
# Journeybook — provider-agnostic off-box backup.
#
# Copies PocketBase backup archives out of the `pb_data` volume to storage on
# another machine. Run it from the deployment host on a schedule (cron/systemd)
# AFTER PocketBase's own scheduled backups have run (see server/pb_hooks).
#
# The destination is pluggable: point it at an rclone remote OR an rsync target.
# An on-box copy is NOT a backup — always send it somewhere else.
#
# Config (environment, or docker/.env which is sourced if present):
#   BACKUP_REMOTE        rclone remote:path      e.g. "gdrive:journeybook-backups"
#   BACKUP_RSYNC_TARGET  rsync target            e.g. "backup@host:/srv/jb-backups"
#   BACKUP_STAGE_DIR     local staging dir       (default: a temp dir)
#   PB_DATA_DIR          read from this dir instead of Docker (also useful locally)
#   COMPOSE_PROJECT_NAME override the volume prefix (default: directory name)
#
# Exactly one destination must be configured. Exits non-zero on any failure so a
# scheduler can alert on it.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f docker/.env ]; then
  # shellcheck disable=SC1091
  set -a && . docker/.env && set +a
fi

log() { printf '[backup-offsite] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

stage="${BACKUP_STAGE_DIR:-}"
created_stage=0
if [ -z "$stage" ]; then
  stage="$(mktemp -d)"
  created_stage=1
fi
cleanup() { [ "$created_stage" = 1 ] && rm -rf "$stage"; }
trap cleanup EXIT

# --- collect the backup archives -------------------------------------------
if [ -n "${PB_DATA_DIR:-}" ]; then
  [ -d "$PB_DATA_DIR/backups" ] || die "PB_DATA_DIR/backups not found: $PB_DATA_DIR/backups"
  log "staging from $PB_DATA_DIR/backups"
  cp -a "$PB_DATA_DIR/backups/." "$stage/"
elif command -v docker >/dev/null 2>&1; then
  project="${COMPOSE_PROJECT_NAME:-$(basename "$PWD")}"
  volume="${project}_pb_data"
  log "staging from docker volume $volume"
  # A stopped container cannot be copied from; mount the volume directly so the
  # backup does not depend on the stack running.
  docker run --rm \
    -v "${volume}:/data:ro" \
    -v "${stage}:/stage" \
    alpine:3.20 sh -c 'cd /data/backups 2>/dev/null && cp -a . /stage/' \
    || die "could not read backups from volume $volume"
else
  die "set PB_DATA_DIR or install docker"
fi

# shellcheck disable=SC2012
count="$(find "$stage" -maxdepth 1 -type f | wc -l | tr -d ' ')"
[ "$count" -gt 0 ] || die "no backup archives found to copy"
log "found $count archive(s) to send"

# --- send it off-box --------------------------------------------------------
if [ -n "${BACKUP_REMOTE:-}" ]; then
  command -v rclone >/dev/null 2>&1 || die "BACKUP_REMOTE set but rclone is not installed"
  log "rclone copy -> $BACKUP_REMOTE"
  rclone copy "$stage" "$BACKUP_REMOTE" --checksum --transfers 2
elif [ -n "${BACKUP_RSYNC_TARGET:-}" ]; then
  command -v rsync >/dev/null 2>&1 || die "BACKUP_RSYNC_TARGET set but rsync is not installed"
  log "rsync -> $BACKUP_RSYNC_TARGET"
  rsync -az --partial "$stage/" "$BACKUP_RSYNC_TARGET/"
else
  die "no destination configured: set BACKUP_REMOTE or BACKUP_RSYNC_TARGET"
fi

log "done"
