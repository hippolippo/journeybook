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
   you and your partner. Open registration is disabled by design.

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

Restore by extracting a `pb_data` archive back into the volume while the stack
is stopped, then `docker compose up -d`.

Automated off-box backups are still to be wired up.

## Dev credentials

`server/setup.sh` and the defaults in `server/README.md` are **local
development only** and are not used by this deployment.
