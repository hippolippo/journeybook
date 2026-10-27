# Journeybook server (PocketBase)

Self-hosted PocketBase backend. The binary and `pb_data/` are gitignored; the
**schema is committed as JS migrations** in `pb_migrations/`.

## Run locally

```sh
./server/setup.sh
```

This downloads the PocketBase binary (if needed), creates the admin and the two
app users, and serves on `http://127.0.0.1:8090` (admin UI at `/_/`).

Point the frontend at it with a `.env.local`:

```sh
VITE_PB_URL=http://127.0.0.1:8090
```

When `VITE_PB_URL` is unset the app runs against local storage instead.

## Dev credentials (override via env)

| Var                                    | Default                                         |
| -------------------------------------- | ----------------------------------------------- |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | `admin@journeybook.local` / `journeybook-admin` |
| `JB_USER1_EMAIL` / `JB_USER1_PASSWORD` | `you@journeybook.local` / `journeybook-you`     |
| `JB_USER2_EMAIL` / `JB_USER2_PASSWORD` | `her@journeybook.local` / `journeybook-her`     |

These are **local development defaults**, not secrets.

> The notes email needs real SMTP credentials in the admin UI; without them the
> notification is skipped and logged. Nothing else in local development needs
> mail.

## Collections

`users` (auth, invite-only) · `nodes` · `pages` · `elements` · `room`
(one shared row, fixed ID + create guard) · `room_items` · `room_layouts` ·
`media` (Protected files) · `image_presets` · `events` · `notes` · `trash`.
Most data rules require an authenticated user (one shared space). `notes` is the
exception: drafts are visible only to their author, and sent letters are visible
to the author and recipient. Realtime is enabled on all of them.

PocketBase serializes each hook callback in an isolated scope; top-level
functions/constants in a `.pb.js` file are not visible inside the callback. Keep
shared helpers in a CommonJS module (for example `pb_hooks/notes-lib.js`) and
`require()` them inside each handler.

### Notes email and locking

`pb_hooks/notes.pb.js` sends a short notification when a draft becomes `sent`
(no letter content in the email). Configure **Settings → Mail settings** with an
SMTP provider and sender address, and set **Settings → Application URL** to the
public app URL (for example `https://haftels.com/journeybook`); that URL is used
for the deep link. The production Alpine image has no local `sendmail`, so SMTP
is required there; use **Send test email** in the admin UI before testing letters.
Sending is best-effort: failures are logged and never block the letter. A
15-minute cron retries while `emailedAt` is 0; `emailLastAttempt` provides a
cooldown. The hook also prevents the recipient from rewriting a sent letter's
content and enforces the author's "editable until opened" lock, leaving only
`deletedAt` available after opening. A rejected concurrent save is retained for
the client's retry/discard recovery lane.

For a `notifications@haftels.com` sender, verify the domain with the SMTP
provider and add its SPF, DKIM and return-path records at the DNS host. Publish
a DMARC policy (`p=none` while testing, then `p=quarantine`) and inspect a test
message’s headers for SPF, DKIM and DMARC passes. The sender address and app URL
are PocketBase settings (`meta.senderAddress` / `meta.appURL`), not hardcoded in
the hook; an outbound-only address does not need an inbox unless replies should
work.

Media files are **Protected**: `/api/files/...` requires a short-lived file token
obtained through the authenticated PocketBase API. The web app refreshes that
token in the background; direct links without one are rejected.

Relationships are plain text IDs, not PocketBase relations. Soft-deletable
collections carry `deletedAt` (epoch ms, `0` = live); a daily hook hard-purges
trash older than 30 days. Media files are capped at 25 MB and served with
`480x480` / `1200x1200f` thumbnails.

Schema changes go in a new numbered migration in `pb_migrations/` and must be
reflected in [`../SPEC.md`](../SPEC.md) (§13) in the same change.
