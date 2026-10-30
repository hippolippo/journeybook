# Deployment

Journeybook runs as two containers behind Caddy on a small VPS, served under a
URL subpath (default `/journeybook`):

- **pb** — PocketBase (SQLite + file storage + auth + realtime). Data lives in
  the `pb_data` named volume.
- **web** — the built Vue SPA, served statically, with Caddy reverse-proxying
  `{APP_BASE}/api/*` and `{APP_BASE}/_/*` to `pb` and terminating TLS. The
  production SPA registers an app-shell service worker; it caches static assets
  only, never API responses or protected media.

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
- A DNS `A` record for `DOMAIN` pointing at the VPS. Cloudflare's proxy may be
  enabled with **Full (strict)** TLS once the origin certificate is valid; do not
  use Flexible. Resend/email MX and TXT records must remain **DNS only**.
- A non-root `deploy` user with an SSH key and membership in the `docker` group.

## Configuration (GitHub repo settings)

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable              | Purpose                                              | Default        |
| --------------------- | ---------------------------------------------------- | -------------- |
| `DOMAIN`              | Public hostname Caddy serves                         | `haftels.com`  |
| `APP_BASE`            | URL path the app is served under (no trailing slash) | `/journeybook` |
| `BACKUP_REMOTE`       | Optional rclone remote for off-box backups           | —              |
| `BACKUP_RSYNC_TARGET` | Optional rsync target for off-box backups            | —              |

**Secrets**:

| Secret              | Purpose                         |
| ------------------- | ------------------------------- |
| `DEPLOY_HOST`       | Server hostname or IP           |
| `DEPLOY_USER`       | SSH user (e.g. `deploy`)        |
| `DEPLOY_SSH_KEY`    | Private key for the deploy user |
| `PB_ADMIN_EMAIL`    | PocketBase superuser email      |
| `PB_ADMIN_PASSWORD` | PocketBase superuser password   |

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

## TLS and Cloudflare proxy

- **Real domain** — Caddy issues and renews the origin certificate automatically.
  Cloudflare's web proxy may be enabled with **SSL/TLS → Full (strict)**. Never
  use Flexible, which can create a redirect loop. If Caddy's renewal ever fails
  behind the proxy, use a Cloudflare Origin Certificate instead.
- **Resend/email DNS** — MX, SPF and DKIM records must stay **DNS only**. The
  Cloudflare orange-cloud proxy applies to web A/AAAA/CNAME records, not mail.
- **www redirect** — add a proxied `www` CNAME to the apex, then create a
  Cloudflare **Rules → Redirect Rules** rule from `www.haftels.com` to
  `https://haftels.com` preserving the path and query string. Keep the application
  URL on the apex (`https://haftels.com/journeybook`).
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

## Notes email

The notes notification is sent by `server/pb_hooks/notes.pb.js`. After the first
deploy:

1. Open the PocketBase admin UI at `{APP_BASE}/_/` and go to **Settings → Mail
   settings**. Enable SMTP and enter the host, port, username, password and TLS
   mode for the sending mailbox. The Alpine `pb` image has no local `sendmail`, so
   the SMTP fields are required in production.
2. Set a **sender address** and sender name; the notes hook uses these as the
   `From` values. Use **Send test email** until it succeeds.
3. In **Settings → Application URL**, set the public app URL, for example
   `https://haftels.com/journeybook`. The note email uses it to link straight to
   the letter; without it the email contains a relative link.
4. Send a letter between the two accounts and confirm the recipient receives
   the notification and that the letter opens from the link. If delivery fails,
   check the PocketBase logs; the hook retries every 15 minutes while
   `emailedAt` is 0.

Mail is best-effort. A failed send is logged, does not block the letter, and is
retried by a 15-minute cron while `emailedAt` is still 0; `emailLastAttempt`
prevents rapid repeats. The letter itself never depends on SMTP. The notes hook
also enforces the author edit-lock after the recipient opens a letter; only
moving it to trash remains available.

PocketBase's generic **Login from a new location** alert is disabled by
migration `1700000019_disable_login_alerts.js`. Leave it disabled so the only
automated email is the letter notification.

### Sender authentication

To use `notifications@haftels.com`, verify `haftels.com` with the SMTP provider
and publish the provider’s SPF, DKIM and return-path records in Cloudflare DNS.
Do not add a second SPF TXT record; merge `include:` mechanisms instead. Add a
DMARC record such as:

```txt
v=DMARC1; p=none; rua=mailto:YOUR-MONITORED-ADDRESS
```

Start with `p=none` while checking `Authentication-Results: ... spf=pass ...
dkim=pass ... dmarc=pass`, then move to `p=quarantine` once the records are
stable. The sender address is not hardcoded: the notes hook reads
`settings.meta.senderAddress`, and the public link reads `settings.meta.appURL`,
both from PocketBase settings. An outbound-only address does not need an inbox;
if replies should work, add a real mailbox or forwarding for it.

Album media is served as **Protected** PocketBase files. Direct
`/api/files/...` URLs require a short-lived token obtained by a signed-in user;
the web app refreshes that token automatically. Do not expose those URLs
publicly.

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
