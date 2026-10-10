# journeybook

A private, long-distance memory-keeping app for exactly two people — a shared
scrapbook and a shared room. Scrapbooks, notes, real-time games, and camera.

- Product & technical spec: [`SPEC.md`](SPEC.md)
- Design mockups & visual spec: [`design/`](design/) ([`design/SPEC.md`](design/SPEC.md))
- Agent constitution: [`AGENTS.md`](AGENTS.md)
- Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Stack

Vue 3 + TypeScript + Vite, Pinia, Vue Router. Backend: **PocketBase** (self-hosted)
for database, file storage, auth, and realtime. The app also runs against a
local-storage adapter when no backend is configured.

## Commands

```sh
pnpm install       # dependencies (pnpm)
pnpm dev           # dev server
pnpm typecheck     # vue-tsc
pnpm lint          # eslint
pnpm test          # vitest unit tests
pnpm test:e2e      # playwright e2e (system Chrome, local-storage mode)
pnpm build         # typecheck + production build
```

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
- **Room** rendered from a data catalog (default layout matches the mockup);
  day/night (auto by reference timezone + manual override); responsive
  band-relative placement. Wall/floor options and per-item color slots.
- **Scrapbooks**: folders/books tree; two-row shelf with arrowheads and a pinned
  toolbar; **square pages** with freeform overlapping elements; desktop shows a
  two-page spread (1–2, 3–4), mobile shows one page.
- **Room editor** (desktop): move/select/resize/rotate/flip/depth, recolor
  (presets + custom picker), swap wall/floor, day/night, and author desktop vs
  **mobile layouts** with a "hide in mobile" option and mobile preview.
- **Realtime**: with PocketBase, room and content updates propagate to both users.

## Layout

```
src/
  assets/svg/      SVG catalog (one file per asset)
  catalog/         catalog items, wall/floor options, default room layout
  data/            types, storage adapter, PocketBase backend, seed content
  room/            geometry (bands), day/night, pagination, RoomItem, clock
  stores/          Pinia stores (app data, editor, auth)
  views/           Home, Organizer, Book, Login
  editor/          room editor panel
server/            PocketBase migrations, setup script (binary + pb_data gitignored)
```

## Roadmap

Phase 1: frontend + local persistence (done). Phase 2: PocketBase schema, auth,
realtime (done). Next: Notes, Games, Camera.
