# Deployment

Journeybook runs as two containers behind Caddy on a small VPS, served under a
URL subpath (default `/journeybook`):

- **pb** — PocketBase (SQLite + file storage + auth + realtime). Data lives in
  the `pb_data` named volume.
- **web** — the built Vue SPA, served statically, with Caddy reverse-proxying
  `{APP_BASE}/api/*` and `{APP_BASE}/_/*` to `pb` and terminating TLS.

Images are built by GitHub Actions and pushed to GHCR; the server only pulls
them, so the box needs no build toolchain. The same images work at the root or
under any subpath, configured entirely by parameters.

## How a deploy works

On every push to `main` (or a manual **Deploy** run), `.github/workflows/deploy.yml`:

1. Builds `web` and `pb` images and pushes them to
   `ghcr.io/hippolippo/journeybook-{web,pb}`, tagged `:<commit-sha>` and `:main`.
2. SSHes to the server, uploads the compose file and scripts, and runs
   `scripts/deploy.sh`, which:
   - stops the stack,
   - **backs up `pb_data`** to a timestamped archive,
   - pulls the new images,
   - upserts the PocketBase superuser from the configured credentials,
   - starts the new stack and waits for health,
   - prunes old snapshots and verifies the public API.

A redeploy can therefore never lose data: the snapshot is taken before anything
is replaced.

## Prerequisites

- A VPS with Docker + the Compose plugin, reachable on ports 80 and 443.
- A DNS `A` record for `DOMAIN` pointing at the VPS. On Cloudflare this must be
  **DNS only** (grey cloud) so Caddy can complete its Let's Encrypt challenge.
- A non-root `deploy` user with an SSH key and membership in the `docker` group.

## Configuration (GitHub repo settings)

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Purpose | Default |
| --- | --- | --- |
| `DOMAIN` | Public hostname Caddy serves | `haftels.com` |
| `APP_BASE` | URL path the app is served under (no trailing slash) | `/journeybook` |
| `BACKUP_REMOTE` | Optional rclone remote for off-box backups | — |
| `BACKUP_RSYNC_TARGET` | Optional rsync target for off-box backups | — |

**Secrets**:

| Secret | Purpose |
| --- | --- |
| `DEPLOY_HOST` | Server hostname or IP |
| `DEPLOY_USER` | SSH user (e.g. `deploy`) |
| `DEPLOY_SSH_KEY` | Private key for the deploy user |
| `PB_ADMIN_EMAIL` | PocketBase superuser email |
| `PB_ADMIN_PASSWORD` | PocketBase superuser password |

GHCR authentication uses the workflow's built-in `GITHUB_TOKEN` — no stored
registry credential. Credentials are passed to the server over stdin (base64)
and never appear in a process list.

## First deploy

1. Add the variables and secrets above.
2. Push to `main` (or run **Deploy** from the Actions tab).
3. Open `https://<DOMAIN><APP_BASE>/_/` and sign in with the superuser
   credentials. In the `users` collection, create the two accounts for you and
   your partner, setting each one's **name** and **role** (`him`/`her`). Open
   registration is disabled by design.

## Updating

Merge to `main`. That's it. To re-run without a code change, use **Deploy →
Run workflow**.

## Rotating credentials

Change `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` in the repo secrets and redeploy;
the superuser is upserted on every deploy, so the values you set are the values
in use.

## TLS

- **Real domain** — Caddy issues and renews the certificate automatically; keep
  the DNS record **DNS only**.
- **Bare IP / no DNS** — add `tls internal` inside the site block in
  `docker/Caddyfile`; Caddy uses its internal CA (browsers warn until trusted).

## Backups

Content is precious. Three layers:

1. **On every redeploy** — `scripts/deploy.sh` snapshots `pb_data` into
   `~/journeybook/backups/pb_data-<timestamp>.tar.gz` on the host, keeping the
   newest 10. On-box only: it survives a bad deploy or corrupt data, not a lost
   disk.
2. **PocketBase scheduled** — `server/pb_hooks/backups.pb.js` creates an archive
   daily at 03:00 (retaining 14) inside the `pb_data` volume.
3. **Off-box (required once holding real memories)** — `scripts/backup-offsite.sh`
   copies the newest archives to another machine. Set `BACKUP_REMOTE` (rclone) or
   `BACKUP_RSYNC_TARGET` (rsync) as a repo variable and schedule the script on
   the host, e.g.:

   ```cron
   15 4 * * *  cd "$HOME/journeybook" && ./scripts/backup-offsite.sh >> "$HOME/journeybook-backup.log" 2>&1
   ```

   An on-box copy is not a backup — send it somewhere else.

### Restore drill (do this before you need it)

1. Stop the stack: `docker compose --env-file docker/.env down`.
2. Extract a snapshot into the volume:
   ```sh
   docker run --rm \
     -v journeybook_pb_data:/data \
     -v "$HOME/journeybook/backups":/backup \
     alpine sh -c 'rm -rf /data/* && tar xzf /backup/<archive>.tar.gz -C /data'
   ```
   (Alternatively, use Settings → Backups → Restore in the admin UI for a
   PocketBase `.zip` archive.)
3. `IMAGE_TAG=<sha> ./scripts/deploy.sh` (or re-run the workflow) and confirm the
   expected books and images load.

## Running locally

The dev server and local Compose still work at the root:

```sh
pnpm dev                                  # Vite at http://localhost:5173
pnpm build                                # root-based production build
docker compose --env-file docker/.env up -d --build   # local stack at <APP_BASE>
```

`APP_BASE` (build args for `web`) and `DOMAIN` (Caddy) control the path and host.

## Dev credentials

`server/setup.sh` and the defaults in `server/README.md` are **local
development only** and are not used by this deployment.
