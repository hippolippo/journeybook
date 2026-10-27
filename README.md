# journeybook

A private, long-distance memory-keeping app for exactly two people — a shared
scrapbook and a shared room. Scrapbooks, notes, real-time games, and camera.

- Product & technical spec (source of truth): [`SPEC.md`](SPEC.md)
- Design mockups (visual reference only): [`design/`](design/)
- Agent constitution: [`AGENTS.md`](AGENTS.md)
- Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Stack

Vue 3 + TypeScript + Vite, Pinia, Vue Router. Backend: **PocketBase** (self-hosted)
for database, file storage, auth, and realtime. The app also runs against a
local-storage adapter when no backend is configured.

## Commands

```sh
pnpm install       # dependencies (pnpm)
pnpm dev           # dev server (localhost)
pnpm dev:host      # dev server on the LAN for phone testing
pnpm typecheck     # vue-tsc
pnpm lint          # eslint
pnpm test          # vitest unit tests
pnpm test:e2e      # playwright e2e (system Chrome, local-storage mode)
pnpm build         # typecheck + production build
```

`pnpm dev:host` binds Vite to `0.0.0.0` and prints a `Network:` URL. Open that URL
on a phone connected to the same Wi-Fi; allow `node` through the macOS firewall if
prompted. Without `VITE_PB_URL`, data remains local to each device. Camera/mic
testing needs a secure context (HTTPS), not plain LAN HTTP.

## Backend (PocketBase)

```sh
./server/setup.sh          # downloads the binary, creates admin + the two users, serves :8090
```

Then point the frontend at it with `.env.local` (see `.env.example`):

```sh
VITE_PB_URL=http://127.0.0.1:8090
```

With `VITE_PB_URL` set, the app shows a login screen, hydrates from PocketBase,
and **syncs room + content live** across both users. Unset, it runs against local
storage. Schema lives in committed JS migrations (`server/pb_migrations/`).
See [`server/README.md`](server/README.md) for details and dev credentials.

## What works

- **Auth**: two invite-only accounts; login gate when a backend is configured.
  Each account has a **name** and a **role** (`him`/`her`) so greetings, the
  room-bar avatars, and visit directions read correctly for whoever is signed in.
- **Room**: an empty-by-default illustrated room rendered from a data catalog
  (`src/assets/svg/*.json` sidecars); hosts/attachment, recolourable slots,
  day/night (auto by reference timezone + manual override), dynamic lighting,
  effects, shadows, and responsive band-relative placement.
- **Scrapbooks**: folders/books tree; two-row shelf with arrowheads and a pinned
  toolbar; **square pages** with freeform overlapping elements; desktop shows a
  two-page spread (1–2, 3–4), mobile shows one page. Image album, frames, papers,
  notes, stickers, tape, layers, and effects are all data-driven.
- **Notes (letters)**: private drafts and shared sent letters; rich text on the
  existing note papers with a fixed width and an author-set page height, where
  text past the page floats below in red. Reuses the wax-seal and postage-stamp
  art for the envelope; send/inbox/outbox, a best-effort notification email with
  scheduled retry, an opening animation, trash/restore, and a Home unread badge.
  Notes compose on phones too, with a compact one-row composer bar.
- **Room editor** (desktop): move/select/resize/rotate/flip/depth, duplicate,
  lock, recolor (presets + custom picker), swap wall/floor, day/night, named
  layouts, and derived/editable **mobile placements** with a preview.
- **Calendar**: shared month grid, visits with flight legs, anniversaries,
  birthdays, occasions, recurrence, and a togetherness countdown.
- **Data safety**: local-storage mode for dev, PocketBase + replay-safe outbox with
  a retry/discard recovery lane, Protected media files, a single shared room row,
  validated re-keyed imports, 30-day trash expiry, integrity check, offline
  snapshot + app-shell service worker, whole-library export/import, and
  backup-on-redeploy.
- **Realtime**: with PocketBase, room, content and note updates propagate to both
  users.

## Layout

```
src/
  assets/svg/      SVG catalog (one file per asset, room sidecars as .json)
  calendar/        event model, recurrence, metadata, dialog/list
  catalog/         catalog loader/types, options, recipes, effects, lighting
  components/      shared shell components (room bar, page canvas, icons)
  composables/     viewport, reduced motion, asset URLs
  data/            types, storage, PocketBase backend, outbox, trash, transfers
  editor/          room editor panel and exit dialog
  notes/           note model helpers, rich text, paper/envelope assets, views' parts
  room/            geometry, attachment, day/night, lights, effects, RoomStage
  scrapbook/       page editor, notes, frames, papers, effects, layers
  stores/          Pinia stores (app data, room editor, page editor, auth)
  views/           Home, Organizer, Book, Calendar, Settings, Login
server/            PocketBase migrations/hooks, setup script
docker/            Dockerfiles and Caddyfile
scripts/           deploy and off-box backup scripts
```

## Roadmap

Phase 1: frontend + local persistence (done). Phase 2: PocketBase schema, auth,
realtime (done). Notes (done). Next: Games, Camera.
