# Deployment

Journeybook runs as two containers behind Caddy:

- **pb** — PocketBase (SQLite + file storage + auth + realtime). Data lives in
  the `pb_data` named volume.
- **web** — the built Vue SPA, served statically, with Caddy reverse-proxying
  `/api/*` and `/_/*` to `pb` and terminating TLS.

Same-origin, so the SPA is built with a relative `VITE_PB_URL=/` and the images
are domain-agnostic — the same images work on home hardware and on a VPS.

## Prerequisites

- Docker with the Compose plugin (`docker compose version`).
- Ports `80` and `443` reachable from wherever you access the app.
- A DNS name (recommended) pointing at the host, for automatic TLS.

## First boot

```sh
cp docker/.env.example docker/.env   # set DOMAIN
docker compose --env-file docker/.env up -d --build
```

Starting with no data has an empty `pb_data` volume, so Caddy issues an
internal certificate for `localhost` by default. Once `DOMAIN` is a real name
with DNS pointing here, Caddy provisions a trusted certificate automatically.

## Create the accounts (manual, on purpose)

1. Open `https://<DOMAIN>/_/` and create the first superuser when prompted
   (PocketBase's install screen).
2. In the admin UI, open the `users` collection and create the two accounts for
   you and your partner. For each, set **name** (shown around the app) and
   **role** (`him` or `her`, used to phrase things from each person's side).
   Open registration is disabled by design.

Credentials are never placed in env or compose files.

## TLS

- **Real domain** — set `DOMAIN` in `docker/.env`; Caddy handles issuance and
  renewal. Nothing else to do.
- **Bare LAN IP / no DNS** — add `tls internal` inside the site block in
  `docker/Caddyfile`. Caddy uses its internal CA; browsers will show a warning
  unless the CA is trusted.

## Updating

```sh
git pull
docker compose --env-file docker/.env up -d --build
```

PocketBase applies any new migrations in `server/pb_migrations/` on start.

## Moving from home hardware to a VPS

The images are portable. To migrate:

1. Back up `pb_data` (below).
2. On the VPS, clone the repo and copy `docker/.env`.
3. Restore `pb_data` into the volume, then `docker compose up -d --build`.
4. Point DNS at the VPS and confirm TLS.

## Backups

Content is precious. PocketBase's data (`pb_data`) is a SQLite database plus
uploaded files in one directory. Back it up **off-box** regularly and always
before a schema/migration change.

### Automated backups (on-box)

PocketBase is configured by `server/pb_hooks/backups.pb.js` to create a backup
every day at 03:00 and keep the 14 most recent, landing in `pb_data/backups`
inside the `pb_data` volume. An admin who changes the schedule in
Settings → Backups keeps their setting. On-box backups protect against corrupt
data and bad writes, but they do **not** survive losing the disk or volume.

### Automated off-box copy (required)

`scripts/backup-offsite.sh` copies the newest archives to storage on another
machine. It is destination-agnostic: configure **either** an rclone remote
**or** an rsync target in `docker/.env`:

```sh
# either
BACKUP_REMOTE=gdrive:journeybook-backups
# or
BACKUP_RSYNC_TARGET=backup@host:/srv/journeybook-backups
```

The host needs `rclone` or `rsync` installed. The script reads the backups via
the `pb_data` volume (works even when the stack is stopped) and exits non-zero
on failure so a scheduler can alert. Run it after the on-box backup, e.g. a
host crontab at 04:15:

```cron
15 4 * * *  cd /opt/journeybook && ./scripts/backup-offsite.sh >> /var/log/journeybook-backup.log 2>&1
```

This is a real off-box backup because the archive leaves the machine. Verify it
works end to end with the restore drill below. `rclone` to Google Drive, S3,
Backblaze B2, etc. all work the same way; PocketBase also has a built-in S3
backup target in Settings → Backups if you prefer that.

### Manual backup

**Via the admin UI (no downtime).** Settings → Backups → _Create backup_. The
archive lands in `pb_data/backups` inside the `pb_data` volume; copy it out:

```sh
docker compose cp pb:/pb/pb_data/backups ./backups
```

**Fully consistent offline snapshot.** Stop the stack, archive the volume, then
start it again:

```sh
docker compose --env-file docker/.env stop
docker run --rm \
  -v journeybook_pb_data:/data \
  -v "$PWD/backups":/backup \
  alpine tar czf /backup/pb_data-$(date +%Y%m%d).tar.gz -C /data .
docker compose --env-file docker/.env start
```

In both cases, copy the resulting archive to storage on another machine
(rsync, S3, etc.) — an on-box copy is not a backup. The volume name is prefixed
with the Compose project name (`journeybook` by default, from the directory).

### Restore drill (do this before you need it)

Restoring is only trustworthy if you have practised it:

1. Stop the stack: `docker compose --env-file docker/.env down`.
2. Copy the chosen archive back into the volume. PocketBase backup `.zip`
   archives restore in place; a `pb_data-*.tar.gz` snapshot restores by
   extracting into the volume:
   ```sh
   docker run --rm \
     -v journeybook_pb_data:/data \
     -v "$PWD/backups":/backup \
     alpine sh -c 'rm -rf /data/* && tar xzf /backup/<archive>.tar.gz -C /data'
   ```
   (Alternatively, use Settings → Backups → Restore in the admin UI.)
3. `docker compose --env-file docker/.env up -d --build` and confirm the app
   loads the expected books and images.

## Dev credentials

`server/setup.sh` and the defaults in `server/README.md` are **local
development only** and are not used by this deployment.
