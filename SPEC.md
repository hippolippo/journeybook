# Journeybook — Specification

Status: **Draft v0**. This is the initial product and technical spec. The room
customization section (§7) is intentionally specified before implementation; the
current `design/` mockups do not yet implement it. Visual/design details for the
first slice live in [`design/SPEC.md`](design/SPEC.md), which this document
supersedes where they disagree.

## 1. Overview

Journeybook is a private, long-distance memory-keeping app for exactly two
people. It is not a product with a market — it is a shared scrapbook and a shared
room, made to feel personal, warm, and safe.

Core capabilities:

- **Scrapbooks**: nests of folders and books; each book is a sequence of square
  pages you fill with photos, notes, stickers, and doodles.
- **Room**: an illustrated shared room that both users customize — wall and
  floor, furniture, wall decor, and trinkets — with a day and night state.
- **Notes**: shared written entries.
- **Games**: small real-time multiplayer games between the two users.
- **Camera**: real-time camera features (capture, share, together-in-the-moment).

Success is delight and reliability for two people, not scale. Optimize for low
cost, low maintenance, and data safety.

Non-goals: public sign-ups, many users, teams, monetization, a marketplace of
user art.

## 2. Users & auth

- Exactly **two** accounts: the owner and their partner. Invite-only; open
  registration is disabled after setup.
- Both users share one space: the same scrapbooks, notes, and **one shared room**.
- Auth and sessions are handled by PocketBase. Acceptable: email/password, and
  optionally a passkey/OAuth provider. Decide before deploy.

## 3. Architecture & stack

- **Frontend**: Vue 3 SPA, TypeScript (strict), `<script setup>` Composition API,
  Pinia for state, Vue Router. Built with Vite.
- **Backend**: PocketBase, self-hosted on a small VPS (provider TBD), fronted by
  Caddy for TLS. PocketBase provides the SQLite database, file storage, auth, and
  realtime subscriptions.
- **Realtime**: PocketBase realtime subscriptions for shared-room sync, notes,
  and games; **WebRTC** for camera/media, with PocketBase used for signalling.
- **Assets**: all art is SVG, one file per asset, stored per the repo
  constitution. Customizable items ship **day** and **night** variants.
- **Cost**: single small VPS; no managed services that add recurring cost.

### Data safety

- Content is precious. Automated off-box backups of `pb_data` (DB + uploads) run
  once deployed and hold real memories; backups are not required in local dev.
- Once deployed, backups must run before any data-model/migration change.
- Schema changes are additive by default; destructive migrations need explicit
  approval and a verified backup.

## 4. Asset catalog

Customizable decor is driven by a **catalog** of items known to the app. The
catalog is defined in code (versioned with the app, typed), while the *placements*
users create are stored as data (§6). This keeps art/types shippable with the app
and user data small.

```ts
type Layer = 'wall' | 'floor' | 'surface';
type Band = 'wall' | 'floor';

interface CatalogItem {
  id: string;                     // stable, e.g. 'wall-shelf-sage'
  category: 'wallpaper' | 'flooring' | 'furniture' | 'wallDecor' | 'trinket' | 'pet';
  layer: Layer;                   // where it lives
  defaultSize: { w: number; h: number };   // relative units (see §7.4)
  defaultRotation: number;        // degrees
  orientation?: 'normal' | 'flipX';
  art: { day: string; night?: string };     // SVG refs; night optional -> reuse day
  colorSlots: ColorSlot[];        // recolorable parts
  attach?: 'any' | 'shelf' | 'furniture';  // for surface items
  zHint?: number;                 // default depth within its layer
}

interface ColorSlot {
  id: string;                     // 'body', 'trim', 'accent', 'leaves'...
  default: string;
  palette: string[];              // curated presets
  allowCustom: boolean;           // free picker fallback
}
```

Rules:

- Every catalog item has a **default size**; size, rotation, and orientation are
  overridable per placement.
- Color is set through **slots**: curated palette presets per slot, plus a **free
  color picker** where `allowCustom` is true.
- An item may have day-only or night-only art; if a variant is missing, fall back
  to the other so nothing disappears.
- User-provided art (later) follows the same catalog shape; it is source of
  truth and must not be recolored/cleaned without asking.

## 5. Scrapbooks

### 5.1 Tree

Folders and books form a strict tree; a node lives in exactly one place. Tags are
reserved for later cross-tree search.

```ts
interface Node {
  id: string;
  type: 'folder' | 'scrapbook';
  title: string;
  parentId: string | null;
  tags: string[];
  order: number;
  cover?: CoverColor;   // scrapbooks
}
```

### 5.2 Square pages

**Every page is a locked square (aspect ratio 1:1).** The page canvas never
changes shape; the *content on it* is freeform.

```ts
interface Page {
  id: string;
  bookId: string;
  index: number;         // order within the book
  background?: string;   // paper style id
}

interface Element {
  id: string;
  pageId: string;
  kind: 'photo' | 'note' | 'sticker' | 'doodle' | 'text';
  payload: unknown;      // per-kind (e.g. fileId, text, catalogId)
  // freeform transform within the square canvas (0..1 of the page):
  x: number; y: number;
  w: number; h: number;
  rotation: number;      // degrees
  z: number;             // overlap order
  opacity: number;
  color?: string;
}
```

- Elements may be **resized, rotated, and overlapped** freely; overlap order is
  explicit (`z`).
- Position/size are stored as fractions of the square so rendering is
  resolution-independent.
- Content is clipped to the square page bounds. (Whether elements may deliberately
  hang off an edge is an open question, §12.)

### 5.3 Page presentation

- **Desktop (wide)**: two square pages side by side as a **fixed spread** — the
  left page is always an odd index, the right always the next one. Pages 1–2,
  then 3–4, and so on. Navigation advances a whole spread (step 2).
- **Mobile**: **one** square page at a time; navigation steps by 1.
- The left/right assignment is consistent: page 1 is always on the left, page 2
  on the right.

## 6. Data model (PocketBase collections)

| Collection | Purpose |
| --- | --- |
| `users` | Built-in; exactly two records. |
| `nodes` | Folders & scrapbooks (the tree). |
| `pages` | Square pages belonging to a book. |
| `elements` | Freeform items on a page. |
| `room` | Singleton shared-room config (theme, floor, wall, day/night). |
| `room_items` | Placements of catalog items in the room. |
| `notes` | Shared notes (later). |
| `games` | Game state/signalling (later). |
| `media` | Uploaded photos/files (PocketBase files). |

`room` and `room_items` are **global** (shared by both users), realtime-synced.

```ts
interface Room {
  id: 'room';
  wallId: string;                 // catalog flooring/wallpaper id
  floorId: string;
  dayNightMode: 'auto' | 'day' | 'night';
  referenceTz: string;            // IANA tz used by auto mode, e.g. 'America/Chicago'
  updatedAt: string;
}

interface RoomItem {
  id: string;
  catalogId: string;
  layer: Layer;
  z: number;
  attachTo?: string;              // host RoomItem id for 'surface' items
  color: Record<string, string>;  // slotId -> color
  // Per-viewport layouts (see §7.5):
  desktop: Placement | null;      // null = hidden on desktop
  mobile: Placement | null;       // null = hidden on mobile
}

interface Placement {
  x: number;                      // fraction across its band (0..1)
  y: number;                      // fraction within its band (0..1)
  w: number; h: number;           // size relative to band height (§7.4)
  rotation: number;               // degrees
  orientation: 'normal' | 'flipX';
  autoPlaced?: boolean;           // mobile: derived automatically vs. hand-placed
}
```

## 7. Room customization

The room is a shared, illustrated scene. Both users see the same customization;
both may edit it (permissions are an open question, §12). It is composed of
fixed, reliable layers.

### 7.1 Layers & the fixed boundary

- **Wall band** and **floor band** are separated by a **fixed wall/floor line**.
  This line is **not user-adjustable** and may be relied on by placement math.
- Layers, back to front: `wallpaper` → `flooring` → `wallDecor` (in the wall
  band) → `furniture` (in the floor band) → `surface` items/pets (attached to a
  furniture or wall-shelf host).

### 7.2 Customizable surfaces

- **Wall options**: a selection of wallpapers/colors.
- **Floor options**: a selection of floor materials/colors.
- Both are chosen in the editor and stored on the singleton `room`.

### 7.3 Day / night

- The room has **one** day/night state; every customizable surface and item
  ships **day** and **night** art.
- Mode: **automatic by time** (per the room's `referenceTz`, switched around
  sunrise/sunset) with a **manual override** (force day or force night). Manual
  override wins until cleared.
- Missing variants fall back to the available one.
- Open question: whether day/night should instead follow each viewer's local time
  (the two users are in different zones) — see §12.

### 7.4 Placement, transform, and responsiveness

- Placement is stored **relative to the band**, not in absolute pixels: `x` runs
  across the band (0–1), `y` runs within the band (0–1). The fixed wall/floor
  line makes the floor band a reliable coordinate space.
- Size is stored **relative to the band height**, so an item keeps its
  proportions across screens. Each catalog item has a **default size** that can
  be overridden per placement.
- Each placement also stores **rotation**, **orientation** (flip), **color**
  (per slot), and **z** (depth within its layer).
- Resolution: at render time, band fractions are resolved against the actual
  band geometry (which depends on the viewport), and sizes scale with the band,
  so a global change looks right on every screen. Items are clamped to stay
  on-screen.

### 7.5 Desktop vs. mobile layouts

Customization is authored on desktop, but must render well on phones.

- Each item has a **desktop placement** and a **mobile placement**.
- By default the **mobile placement is derived automatically** from the desktop
  one (scaled/clamped, with overflow trimmed), so a mobile layout always exists
  without extra work.
- The editor lets you **position items separately for the mobile view** (dropping
  the `autoPlaced` flag for that item) while keeping the desktop layout intact.
- Each item has a **"hide in mobile layout"** checkbox: when checked, the item
  simply does not appear on mobile (its desktop placement is untouched).
- The editor provides a **mobile preview** toggle so changes can be checked at
  phone scale while editing.

### 7.6 The editor (desktop-only)

An in-app editor, usable only on desktop/laptop, for building the room:

- Enter/exit edit mode from the room.
- Browse the catalog by category (wallpaper, flooring, furniture, wall decor,
  trinkets, pets).
- Place, select, move, **resize** (handles), **rotate**, **flip**, and reorder
  (z) items on the correct band; surface items attach to a furniture/shelf host.
- Set **color** per slot via palette presets or the custom picker.
- Swap **wall** and **floor**; toggle **day/night** (and set the override).
- Toggle between **desktop and mobile** layouts, use the **mobile preview**, and
  mark items **hidden on mobile**.
- Undo/redo and reset-to-default.
- **Save** writes to `room` / `room_items`; changes are **global** and propagate
  to the other user in realtime.

## 8. Notes, Games, Camera (brief)

- **Notes**: shared written entries, realtime-synced.
- **Games**: small real-time multiplayer games between the two users, driven by
  PocketBase realtime.
- **Camera**: real-time capture/share; WebRTC for media with PocketBase
  signalling. Together-in-the-moment features.

## 9. Responsive & rendering rules

- Render resolves band-relative placements against actual band geometry per
  viewport; sizes scale with the band height.
- Breakpoint switches between the two-page spread (desktop) and single-page
  (mobile) presentation (§5.3), and between desktop/mobile room layouts (§7.5).
- SVG art is referenced or inlined per the art constitution; day/night variants
  swap without layout shift.
- Respect `prefers-reduced-motion` for ambient motion.
- The wall/floor line is a fixed constant shared by rendering and the editor.

## 10. Verification & testing

A task is not done until these pass: `pnpm typecheck`, `pnpm lint`,
`pnpm test` (Vitest), and `pnpm test:e2e` (Playwright) when a flow is affected.

Priority unit tests for this spec:

- Transform math: band-relative placement → pixel positions across viewports.
- Day/night resolution (auto by `referenceTz`, override, missing-variant
  fallback).
- Page pagination: spread pairing (1–2, 3–4) on desktop, single page on mobile.
- Square-canvas element bounds and overlap ordering.
- Auto-derived mobile placement and the "hidden on mobile" rule.

## 11. Roadmap (indicative)

1. Foundation: scaffold, auth (two accounts), PocketBase schema, scrapbook tree.
2. Square pages with freeform elements.
3. Room shell rendered from `room` / `room_items` (read-only at first).
4. Room editor (desktop) with desktop/mobile layouts, day/night, colors.
5. Notes, then Games, then Camera.

## 12. Open questions

- Auth model specifics (email/password vs. passkey/OAuth) and how the two
  accounts are provisioned.
- Day/night "automatic": one shared reference timezone vs. each viewer's local
  time (the users are in different zones).
- Editor permissions: both users have full edit access, or owner-only?
- May square-page elements extend past the page edge, or are they always clipped?
- VPS provider and PocketBase deployment specifics.
- Whether user-supplied art can be added to the catalog, and how it is stored.
