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

| Var | Default |
| --- | --- |
| `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD` | `admin@journeybook.local` / `journeybook-admin` |
| `JB_USER1_EMAIL` / `JB_USER1_PASSWORD` | `you@journeybook.local` / `journeybook-you` |
| `JB_USER2_EMAIL` / `JB_USER2_PASSWORD` | `her@journeybook.local` / `journeybook-her` |

These are **local development defaults**, not secrets.

## Collections

`users` (auth, invite-only) · `nodes` · `pages` · `elements` · `room` (singleton)
· `room_items`. All data rules require an authenticated user (one shared space).
Realtime is enabled on all of them.
