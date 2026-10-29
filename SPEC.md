# Journeybook — Specification

Status: **Living specification of shipped behaviour (v1).**
Last updated: **2026-10-29.**
Implementation reference: `main`.

This document is the single source of truth for what Journeybook is and how it
behaves. It describes the app **as implemented**, with a separate list of known
gaps in §18. Features that exist only as intent live in §19 (Roadmap) and must
not be described here as shipped.

`design/SPEC.md` was merged into this document and removed. The files under
`design/` remain as visual mockups only; behaviour is defined here.

## Spec change log

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-26 | Envelope finish: a continuous outline now sits above the body and flap so the nice border encloses the full rectangle; the flap remains a separate clipped triangle only for the opening animation. The wax seal is larger (19% card / 18% large, capped at 76/96 px) with a slightly larger initial (§16, §22.4).                                                                                 |
| 2026-10-29 | Session recovery: boot-time 401s now clear the stale auth/snapshot/service-worker state and return to login; the load-error screen offers a browser-only **Reset local copy** action. This fixes tabs stuck after deployment or session changes without touching server data (§14.2, §16).                                                                                                         |
| 2026-10-26 | Cloudflare proxy/www: documented proxied web records with Full (strict) TLS, DNS-only Resend MX/TXT records, and a www-to-apex redirect preserving paths/query; the app URL stays on the apex (§4.2, §17).                                                                                                                                                                                         |
| 2026-10-26 | Email delivery setup: documented provider SMTP, sender authentication (SPF/DKIM/DMARC), `notifications@haftels.com`, and the existing non-hardcoded `meta.senderAddress`/`meta.appURL` configuration (§17.5).                                                                                                                                                                                      |
| 2026-10-26 | Envelope stamp labels: the custom stamp controls now read **Stamp** and **Postmark** instead of Paper and Waves, with matching accessible colour-picker labels (§22.3–§22.4).                                                                                                                                                                                                                      |
| 2026-10-26 | Page resize grip: pointer capture/touch-action suppression freezes the stage during the drag, a 96 px edge zone ramps auto-scroll (down while growing, up while shrinking), temporary bottom space preserves scroll range so the grip follows the finger, and the visible pill has a 44 px touch target (§16, §22.3).                                                                              |
| 2026-10-26 | Data safety: outbox creates/deletes are replay-safe; permanent failures move to a persisted retry/discard recovery lane without blocking later writes; the sync pill and Settings expose it (§14.2, §16).                                                                                                                                                                                          |
| 2026-10-26 | Data safety: library/book imports validate and re-key every record/reference, media deletion trashes placed elements with the photo, host deletion detaches children, layouts/presets use trash, the room has a fixed singleton row, and integrity checks cover media/room/note references (§13–§16).                                                                                              |
| 2026-10-26 | Privacy/backend: media files are Protected and use short-lived tokens; the notes hook enforces the author lock after opening, validates participants, and retries email every 15 minutes with a cooldown; hook callbacks use a shared required module because PocketBase isolates callback scope (§13, §14, §16, §17.5, §22.5–§22.6).                                                              |
| 2026-10-26 | Offline/local recovery: remote data/notes/trash/layouts/presets cache in a snapshot with an offline pill, a production app-shell service worker allows offline reload, and local trash/object URLs expire/purge like the server (§14, §16, §17.1).                                                                                                                                                 |
| 2026-10-26 | Drafts list: removed per-card “Draft” repetition (title, chip and timestamp prefix) and the duplicate body preview; cards now show the note paper’s first line and an edited timestamp, with the selected Drafts tab carrying the status (§16, §22.2).                                                                                                                                             |
| 2026-10-26 | Letter editing: clicking the paper outside the text now places the caret at the nearest text position (end below the last line, start above the first, nearest line otherwise) instead of doing nothing (§16, §22.3).                                                                                                                                                                              |
| 2026-10-26 | Mobile composer layout: the Style pencil button sits left of the Letter/Envelope switch so the switch stays put across modes; Paper/Pen panes share the taller content height so the sheet no longer resizes when switching (§16, §22.3).                                                                                                                                                          |
| 2026-10-26 | Mobile colour pickers: the lifted envelope/selected-text layout now stays in place after choosing a colour and only restores when the native picker is dismissed; colour changes no longer drop the layout (§16, §22.3).                                                                                                                                                                           |
| 2026-10-26 | Mobile colour pickers: while a native picker is open the room/composer bars move out of the way, the envelope is pinned to the top area and the selected letter text scrolls to the top; closing restores the normal layout (§16, §22.3).                                                                                                                                                          |
| 2026-10-26 | Mobile envelope editor: controls are permanently open without Style/Done/header chrome; the Envelope/Wax seal/Stamp panel is compact, redundant captions and hints are removed, and the Stamp heading shares a row with the custom Paper/Waves pickers (§16, §22.3).                                                                                                                               |
| 2026-10-26 | Mobile page-height editing: the composer stage keeps an extra 88 px end margin so a taller page can be scrolled clear and its grip reached to shrink it (§16, §22.3).                                                                                                                                                                                                                              |
| 2026-10-26 | Home: removed the wooden shelf plank under the Scrapbooks/Notes buttons and reclaimed its vertical padding; the covers now sit in the centered flex layout directly over the room (§6, §22.7).                                                                                                                                                                                                     |
| 2026-10-26 | Mobile style-sheet scrolling: while the Pen menu is open, the composer stage reserves the panel height so the page bottom (and red overflow) can scroll above it; the room background stays fixed (§16, §22.3).                                                                                                                                                                                    |
| 2026-10-26 | Mobile keyboard behaviour: with the Paper & Pen sheet open the editor stays selectable but the soft keyboard is suppressed; the phone shell stays pinned when the keyboard opens, while the composer stage adds the keyboard inset and scrolls only the paper/caret above it (§5.3, §16, §22.3).                                                                                                   |
| 2026-10-26 | Paper texture/previews: Kraft now renders its grain/fibre texture (previously dropped by the URL resolver) with a stronger grain, and paper-preview cards use a quarter-scale rule/texture rhythm so more of each pattern is visible (§8.5, §16, §22.3).                                                                                                                                           |
| 2026-10-26 | Notes composer controls: the toolbar mirrors the caret/selection formatting (font, size, ink, highlight, toggles and alignment); the mobile Paper & pen sheet uses remembered Paper/Pen tabs and a compact one-row tabs/Done header, sized to their content; dragging the height grip against the bottom auto-scrolls the stage (§16, §22.3).                                                      |
| 2026-10-26 | Notes composer sidebar: the desktop Paper & pen panel is content-sized (capped at the stage with scrolling) instead of stretching to the stage bottom (§16, §22.3).                                                                                                                                                                                                                                |
| 2026-10-26 | Note surfaces use the full shell height: the paper and its red overflow may extend over the room floor to the bottom edge instead of stopping at the content safe area (§5.2, §16, §22.3).                                                                                                                                                                                                         |
| 2026-10-26 | Notes paper picker: larger four-column preview cards with visible paper names and a checked terracotta selected state, so the paper buttons read as tappable choices (§22.3).                                                                                                                                                                                                                      |
| 2026-10-26 | Notes page width + reading zoom: page height no longer changes the visual scale (width is stage-driven and tall pages scroll); compose/read share the phone gutter, and double-click/double-tap in the reader opens a larger vertically scrollable zoom (§16, §22.3, §22.5).                                                                                                                       |
| 2026-10-26 | Notes colours: every swatch group (paper tint, ink, highlight, envelope tint, wax seal) now has a free colour picker, and the stamp exposes custom paper/wave colours in addition to its presets; envelope custom stamp colours persist in the envelope JSON (§12, §16, §22.3–§22.4).                                                                                                              |
| 2026-10-26 | Rich-text typing styles: font, size, ink, highlight and inline toggles now apply at a collapsed caret, and later controls compose with that pending style; no text selection is required. Selection formatting is unchanged (§16, §22.3).                                                                                                                                                          |
| 2026-10-26 | Paper picker: merged the three duplicate Sticky Rose/Sage/Sky papers into one Sticky note entry with its full tint palette, so every paper now has tints and the picker has seven papers (§8.5, §16, §22.3).                                                                                                                                                                                       |
| 2026-10-26 | Composer cleanup: removed the Page section (height readout, fit meter and explanatory copy) from the letter settings panel; the paper grip remains the only height control and overflow is still reported on send (§16, §22.3).                                                                                                                                                                    |
| 2026-10-26 | Mobile Home and paper rules: the Home covers are compact (~240–280 × 100 px at iPhone widths) with a fit-content shelf so the decorated room stays visible; ruled/grid background tiles now match one rule rhythm so the top rule is no longer split or doubled (§6, §16, §22.3, §22.7).                                                                                                           |
| 2026-10-26 | Mobile composer bar: at iPhone widths every control stays on one non-wrapping row — icon back/style, recipient with full status underneath, compact Letter/Envelope switch, and Send/Save; desktop keeps the text labels (§5.3, §16, §22.3).                                                                                                                                                       |
| 2026-10-26 | Mobile polish: the Home covers stack on phones (with taller cards so labels and props stay readable), and the Notes sheet keeps its smaller raised placement.                                                                                                                                                                                                                                      |
| 2026-10-26 | Notes polish: the wax seal carries the author's first initial (G in local mode) in a tonal shade of the seal; ruled/grid papers now share the paragraph line grid and first baseline; the page-height slider was removed in favour of the bottom-edge grip; Home aligns the flower and lined-sheet anchors (§6, §12, §22.3–§22.4).                                                                 |
| 2026-10-26 | Added the standalone Notes (letters) surface: the `notes` collection with private drafts, rich-text letters, fixed-width author-set pages with red overflow, envelope/seal/stamp customisation reusing the shipped wax-seal and postage-stamp art, send/inbox/outbox, opening animation, notification email, Home shelf entry and unread badge. Page notes stay plain text (§2–§6, §8.5, §12–§22). |
| 2026-10-19 | Added recurring-event anchor clamping and `%` / `%%` occurrence numbering with optional start digits, `\%` / `\\` escapes, a title hint, and expandable help (§10).                                                                                                                                                                                                                                |
| 2026-10-19 | Added the per-user room text glow setting (0–1 slider with a floating mini-room preview), synced through the PocketBase user record with a local fallback; documented the day-mode halo (§11, §13, §14.1).                                                                                                                                                                                         |
| 2026-10-19 | Documented the installable web app: Apple touch icon, web app manifest, standalone metadata, icon assets, and base-relative URLs (§4.6, §17.1).                                                                                                                                                                                                                                                    |
| 2026-10-17 | Documented the concrete production deployment (DigitalOcean droplet, `haftels.com/journeybook`, GHCR images, repository variables/secrets, deploy and backup specifics) and confirmed the media thumbnail/caching behaviour; corrected the media file-access risk in §18.                                                                                                                          |
| 2026-10-17 | Full rewrite against the implementation. Merged `design/SPEC.md`, documented the room catalog/lighting/effects, scrapbook editor, calendar, persistence/outbox/trash, deployment, and known gaps. Added the spec-discipline rules in §21.                                                                                                                                                          |
| 2026-10-08 | Initial product and technical spec (`7973394`).                                                                                                                                                                                                                                                                                                                                                    |

---

## 1. Product

Journeybook is a private, long-distance memory-keeping app for exactly two
people: the owner and their partner. It is not a product with a market — it is a
shared scrapbook and a shared room, made to feel personal, warm, and safe.

The guiding feeling is **a cozy cottage scrapbook**: warm paper, soft light,
washi tape, pressed flowers, doilies, a little trodden-in personality. Artsy and
handmade, not glossy or corporate.

Success is delight and reliability for two people, not scale. Optimise for low
cost, low maintenance, and data safety.

Non-goals: public sign-ups, many users, teams, monetisation, a marketplace of
user art, social feeds, and engagement mechanics.

## 2. Scope and current status

### Shipped

- **Room**: full-viewport illustrated room, data-driven catalog, host/attachment
  system, recolouring, day/night, dynamic lighting, effects, shadows, and a
  desktop editor with named layouts.
- **Scrapbooks**: folders and books, square pages, freeform elements (images,
  notes, stickers, tape), frames, papers, image effects, layers/groups, media
  albums, publish flag, duplicate, and file import/export.
- **Calendar**: shared month calendar, visits, anniversaries, birthdays,
  occasions, flight legs, recurrence, and togetherness countdown.
- **Notes**: a standalone letters surface with private drafts, rich-text letters
  on the existing note papers, a fixed-width page with an author-set height,
  envelope/seal/stamp customisation, inbox/outbox, sending, an opening animation,
  a notification email, and a Home shelf entry with an unread badge.
- **Accounts**: exactly two invite-only users with a `him`/`her` role.
- **Data**: local-storage mode for development, PocketBase mode for the deployed
  app, a persistent write outbox, realtime refresh, trash/restore, integrity
  audit, and whole-library export/import.
- **Deployment**: Docker Compose (`pb` + `web`), Caddy with TLS and subpath
  support, GitHub Actions image builds, backup-on-redeploy, and off-box backup
  tooling.
- **Mobile**: read-only content browsing, responsive room/scrapbook/calendar
  layouts, a rotate-to-landscape gate on phones, and Notes composition on phones
  (the calendar and notes are the two editable mobile surfaces).

### Not shipped

- Advanced notes composition: stickers, photos, and multiple text boxes. Notes
  are one page with one text flow.
- Notes in the whole-library or book export (drafts are private), notes search,
  replies, attachments, and notification preferences.
- Games and Camera, despite being part of the product vision.
- Organizer search, tag UI, manual reorder, and move-between-folders.
- Doodles, freehand drawing, and a distinct text element.
- Multi-select, true element grouping, and group transforms in either editor.
- Public sharing/links. "Published" is a read-only UI flag, not a public URL.
- User-supplied art added to the room catalog at runtime.
- Offline app shell/service worker. Local-storage mode is not an offline cache
  for a configured PocketBase backend.
- Server-side conflict resolution. Sync is last-write-wins.
- CI checks (tests, typecheck, lint) before deploy.

## 3. Users and auth

- Exactly **two** accounts: the owner and their partner. Invite-only; public
  registration is disabled at the schema level.
- Both users share one space: the same books, room, calendar, media, and trash.
  The exception is **note drafts**, which are visible only to their author. A
  sent letter is visible to both the author and the recipient. Everything else
  is shared.
- Each account has a `name` and a `role` (`him` or `her`). The role drives
  greetings, avatars, and the wording of visit directions. It does **not** grant
  scrapbook/room permissions; both users can edit and delete the shared content.
  Notes use their own per-user PocketBase rules (§13).
- Auth is PocketBase email/password. There is no signup UI, password-reset UI,
  passkey, or OAuth.
- When no backend is configured, the app runs in local mode with no login.
- When a backend is configured, every route except `/login` requires a session.
  Unauthenticated users are redirected to `/login` with a `redirect` query and
  returned to the target after sign-in (used by note email links); authenticated
  users are redirected away from `/login`.
- Provisioning: `server/setup.sh` creates the two local development accounts;
  production accounts are created manually in the PocketBase admin UI with
  `name` and `role` set (`docs/DEPLOYMENT.md`).

## 4. Architecture and stack

### 4.1 Frontend

- Vue 3 SPA, TypeScript strict mode, `<script setup lang="ts">` Composition API.
- Pinia for state, Vue Router for navigation, Vite for build/dev.
- Vitest + Vue Test Utils for unit/component tests; Playwright for end-to-end
  tests.
- Fonts from Google Fonts: Fraunces (headings), Nunito (body), Caveat and the
  handwriting pens (accents).

### 4.2 Backend

- PocketBase, self-hosted on a 1 GB DigitalOcean droplet (Ubuntu 24.04), fronted
  by Caddy for TLS. Production lives at `https://haftels.com/journeybook/`.
  Cloudflare's web proxy may front the A/CNAME records with **Full (strict)** TLS;
  mail MX/TXT records stay DNS-only. A proxied `www` redirect rule forwards to the
  apex while preserving the path and query. Caddy owns the origin certificate and
  may fall back to a Cloudflare Origin Certificate if proxy renewals fail.
- PocketBase provides SQLite, file storage, auth, and realtime subscriptions.
- The schema is committed as JS migrations in `server/pb_migrations/` and applied
  automatically when the container starts.
- Two container images: `pb` (PocketBase) and `web` (Caddy + built SPA).

### 4.3 Backend selection

- `VITE_PB_URL` set → PocketBase mode (`pbEnabled`): login, remote data, realtime,
  outbox.
- `VITE_PB_URL` unset → local mode: no login, no realtime, no outbox;
  `localStorage` holds the document and IndexedDB holds media bytes.
- Both modes share the same Pinia store and UI components.
- `VITE_BASE` (build arg `APP_BASE`) sets the SPA base path.

### 4.4 Realtime

- PocketBase realtime subscriptions cover `nodes`, `pages`, `elements`, `media`,
  `room`, `room_items`, `room_layouts`, `image_presets`, `events`, `trash`, and
  `notes`. Notes use their own store subscription and pause refresh while a
  letter is being written.
- A remote change schedules a debounced (250 ms) **full refetch**, not a delta
  merge. Bursts are serialised.
- Refetch is skipped while the outbox has pending writes or while an editor
  holds a sync pause.
- Room and page editors pause sync while a draft is open, then refresh on close.
  Remote edits made during that window are not merged into the draft.
- Conflicts are last-write-wins at record granularity. There is no version
  check, field merge, or conflict UI.

### 4.5 Data safety

- Content is precious and personal. Data loss is the worst possible failure.
- Local mode never overwrites an unreadable payload: corrupt or version-mismatched
  documents are copied to `journeybook:v1.corrupt:<timestamp>` first. Notes use
  the same rule under `journeybook:notes:v1.corrupt:<timestamp>`.
- Notes are stored separately from `AppData` and are **not** included in
  library/book export, so a private draft cannot leak through a shared export.
- In PocketBase mode, the deployed app requires off-box backups before it holds
  real memories (§17).
- Schema changes are additive by default. Destructive migrations require explicit
  approval and a verified backup.
- Trash retains deletions for 30 days before a scheduled hard purge.

### 4.6 Installable web app

- The SPA can be added to the iOS home screen as a standalone web app. The shell
  sets `apple-mobile-web-app-capable`, `mobile-web-app-capable`,
  `apple-mobile-web-app-title` (`Journeybook`), and
  `apple-mobile-web-app-status-bar-style`.
- The home-screen icon comes from `public/icons/apple-touch-icon-180.png`, linked
  with `rel="apple-touch-icon"`. iOS ignores the SVG favicon used by browser
  tabs. The PNGs are opaque and generated from
  `src/assets/svg/app-icon.svg`: a full-bleed cream (`#f7efdd`) square with the
  doodle heart centred.
- `public/manifest.webmanifest` sets `name`, `short_name`, `start_url: "./"`,
  `scope: "./"`, `display: standalone`, `theme_color`/`background_color`
  (`#f7efdd`), and 192/512 px icons plus a 512 px maskable icon.
- `index.html` references both with Vite's `%BASE_URL%` placeholder so they
  resolve at the root and under `APP_BASE` (§17.1).
- iOS snapshots the icon when the shortcut is added: updating it requires
  removing and re-adding the shortcut. Safari also caches touch icons, so a
  changed icon may need a new filename.
- No splash-screen (`apple-touch-startup-image`) assets are provided.

## 5. Navigation and shell

### 5.1 Routes

| Route                    | Screen       | Notes                                               |
| ------------------------ | ------------ | --------------------------------------------------- |
| `/login`                 | Login        | Public; only when a backend is configured.          |
| `/`                      | Home         | Greeting, two hero objects, togetherness status.    |
| `/scrapbooks/:folderId?` | Organizer    | Folder contents; omitted `folderId` = root.         |
| `/book/:bookId`          | Book         | Page spread and page editor entry.                  |
| `/notes`                 | Notes        | Letters / Outbox / Drafts; `?tab=outbox` etc.       |
| `/notes/new`             | Compose note | Creates a draft and replaces the URL with its edit. |
| `/notes/:noteId/edit`    | Compose note | Draft, or a sent letter before it is opened.        |
| `/notes/:noteId`         | Note         | Sealed envelope / opened letter; marks it opened.   |
| `/calendar`              | Calendar     | Month grid, day pane, upcoming pane.                |
| `/settings`              | Settings     | Device/room/data controls.                          |

There is no catch-all/404 route; unknown paths render the persistent room shell
with empty content.

### 5.2 Persistent room shell

- `App.vue` renders the room stage behind every route and the routed content in
  a centred column above it. The room is not a route and never unmounts during
  navigation.
- The top room bar overlays the content: home button ("our little room"), the
  togetherness countdown, and the two avatars with an account menu.
- The room bar has no clock. The only clock is the `wall-clock` room item, when
  placed.
- Content is fixed to the viewport height and clips; the app never scrolls
  vertically. Individual panes (organizer shelf, settings, mobile calendar panes,
  editor panels, note stages, and the notes shelves) scroll inside their own
  bounds.
- The note composer and reader are full-height surfaces. Their letter stages
  scroll to reveal text that runs below the paper, and their paper plus red spill
  may extend over the room floor to the bottom edge. On phones the style panel is
  a fixed bottom sheet.
- Settings and the note letter surfaces are allowed to reach the bottom edge in
  the desktop shell; the mobile notes style sheet floats above the floor and
  respects the safe-area inset.

### 5.3 Mobile policy

- Breakpoint: `width <= 760px` is mobile.
- A touch phone in landscape (`width > height`, `height <= 500`) is replaced by a
  "rotate your phone" screen.
- Mobile is **read-only** for scrapbook/room content: no create/rename/delete,
  no page editing, no room editing, no trash/backup/library-check. Calendar and
  Notes remain editable. Notes compose in the normal phone layout, with the style
  controls in a bottom sheet. The composer bar never wraps: back and style are
  icon buttons, the recipient and its full status share a compact two-line block,
  and the mode switch plus Send/Save fill the rest of the row.
- The phone shell is pinned to the layout viewport. Opening the soft keyboard does
  not move or resize the room or top bar; the note stage adds the keyboard inset as
  bottom space and scrolls only the paper/current caret above the keyboard. While
  the Paper & Pen sheet is open the editor stays selectable but the soft keyboard
  is suppressed (`inputmode="none"` / manual virtual-keyboard policy); opening
  the sheet blurs the editor and closing it restores normal keyboard behaviour.
- The read-only policy is enforced by component-level `v-if`/guards, not by route
  metadata, store permissions, or the backend.
- Pinch zoom and multi-touch gestures are disabled; text selection is disabled
  outside form fields and contenteditable regions. Rendered letters are not
  selectable; the composer is contenteditable.
- Safe-area insets are respected on mobile.

## 6. Home

- Tag: "a little home just for two".
- Greeting: "Welcome back, {name}" when authenticated, otherwise "Welcome back,
  you two".
- Two hero objects on one centered shelf layout with no visible wooden plank:
  side by side on desktop, stacked compactly on phones so the decorated room
  stays visible while both labels and props remain readable:
  - **Scrapbooks**: the rose book with a pressed daisy-on-stem; opens the
    organizer root.
  - **Notes**: the same cover shape in sage, with a lined-paper sheet instead of
    the flower. It opens `/notes` and shows a mustard **“N unread”** badge only
    when there is at least one unread letter. No badge is shown at zero.
- One status line derived from the calendar:
  - together → "You're together right now"
  - apart → "N days until we're together"
  - none → "Plan our next visit" (links to Calendar)
- There are no Games/Camera pills or other hero objects. New features are
  expected to become shelf objects; the shelf currently holds Scrapbooks and
  Notes.
- The Home status line does not tick while the page stays open; it recomputes on
  re-render. The room bar countdown refreshes every 30 seconds. The unread badge
  follows the notes store and updates on load and realtime refresh.

## 7. Organizer

- Title is the current folder's pink washi-tape crumb; there is no separate large
  heading.
- Breadcrumb trail runs from "Scrapbooks" to the current folder. Every crumb is
  clickable.
- Contents are the direct children of the current folder, sorted by `order`
  ascending.
- Folders render as manila folders with a peek of paper and a **direct-child**
  count ("N things"). Scrapbooks render as covered books with a page count.
- Covers are one of six colours (`rose`, `sage`, `mustard`, `terracotta`, `sky`,
  `kraft`), assigned randomly on create. There is no cover picker.
- Desktop layout: up to two rows, read left-to-right, with horizontal scrolling.
  Arrowheads appear only when there is more content in that direction; the
  toolbar stays pinned.
- Mobile layout: full-bleed swipeable shelf, no arrows, no create or item menus.
- Toolbar: "New folder" and "New scrapbook". Choosing a type reveals an inline
  form card as the first item; Enter or "Create" creates the node in the current
  folder. Titles are required.
- Per-item menu (desktop hover/focus): Rename, Delete. Books also expose Publish/
  Unpublish, Duplicate, and Export to file. Rename uses `window.prompt`; delete
  uses `window.confirm`.
- Deleting a folder cascades descendants, pages, elements, and media into one
  trash entry (`kind: 'book'`).
- Empty state: "This room is empty" with pressed-flower art; mobile copy differs.
- There is **no search, tag UI, manual reorder, drag reorder, move-between-folders,
  sort control, or filter**. `tags` is stored but unused.

## 8. Scrapbooks and pages

### 8.1 Page model

- Every page is a locked **square** authored on a 480×480 logical canvas and
  uniformly scaled to fit.
- A book is a sequence of pages ordered by integer `index`. Pages are unbounded;
  zero pages is valid ("blank book").
- New pages append at the end. Deleting a page re-normalises remaining indexes to
  `0..n-1`. Moving a page swaps adjacent indexes.
- `background` selects a paper style; `paperColors` overrides recolourable paper
  slots.
- `groups` defines the page's layer groups (see §8.7).

### 8.2 Spread and navigation

- Desktop shows a **two-page spread** only when the measured spread area is at
  least 720×340; otherwise one page.
- Mobile always shows one page.
- Navigation steps by the current per-view count (2 or 1), clamped at the ends.
  There is no swipe or arrow-key paging.
- Labels: `pages X–Y of N` for a spread, `page X of N` for a single page, "blank
  book" for zero pages.
- Page number renders bottom-right on each page.
- Double-click/double-tap opens a 2× single-page overlay with clamped panning;
  Escape or the close button exits.
- Desktop, unpublished books only: hover pencil opens the page editor; "Manage
  pages" opens a thumbnail list with move-earlier/later and delete. No drag
  reorder.

### 8.3 Elements

Persisted element kinds:

| Kind      | Purpose                                                              |
| --------- | -------------------------------------------------------------------- |
| `image`   | Uploaded album photo inside a frame, with crop/zoom/effects.         |
| `photo`   | Legacy gradient placeholder. Rendered, imported, but no creation UI. |
| `note`    | Handwritten/typed text on note paper.                                |
| `sticker` | Recolourable sticker art.                                            |
| `tape`    | Recolourable washi/masking tape strip.                               |

There is no `doodle`, freehand brush, shape, or distinct `text` element.

Common element fields:

```ts
interface ElementBase {
  id: string;
  pageId: string;
  x: number; // centre X as a fraction of the square page
  y: number; // centre Y as a fraction of the square page
  w: number; // width as a fraction of the page
  h: number; // height as a fraction of the page
  rotation: number; // degrees, normalised to (-180, 180]
  z: number; // overlap order, ascending
  opacity: number; // 0..1
  locked?: boolean;
  aspectLocked?: boolean; // default true
  groupId?: string;
  name?: string;
  scale?: number; // whole-element zoom
  flipX?: boolean; // horizontal mirror
  dropShadow?: boolean;
  shadowStrength?: number; // 0..1, default 0.5 when on
}
```

Behaviour:

- Position and size are fractions of the square page, so rendering is
  resolution-independent.
- Elements may be resized, rotated, overlapped, flipped, and scaled freely.
- Resize keeps the opposite corner fixed, respects aspect lock, and has a minimum
  size of 0.03 of the page. Rotated elements resize in their local axes.
- Note notes resize by changing `scale`, not font size; the note box keeps its
  text metrics.
- Content is clipped to the square page bounds.
- Adding or duplicating puts the element on top (`max z + 1`).
- `locked` prevents move/resize/rotate/delete and `updateElement` patches, but
  still allows selection and z/lock changes.
- Elements can be dragged from the palette or clicked to add at the page centre.
  Drop coordinates clamp to 0.02–0.98.

### 8.4 Media and the image editor

- Each book has its own album. Media is filtered by `bookId`; there is no shared
  library or cross-book reuse.
- Upload accepts `image/*`, `.heic`, `.heif`. HEIC/HEIF is lazily transcoded to
  JPEG at quality 0.9 before upload.
- Local mode stores bytes in IndexedDB (`journeybook-media` / `blobs`) and serves
  object URLs.
- PocketBase mode stores a `media` record plus a 25 MB max file. The server
  allowlist is JPEG, PNG, WebP, GIF, AVIF; SVG is not accepted by the backend even
  though the client accepts it.
- Thumbnails: the app requests generated variants via `mediaUrl(asset, thumb)` —
  `480x480` in album grids, pickers and drag ghosts, and `1200x1200f` for page
  images. PocketBase generates them on demand (existing uploads included). Local
  mode serves originals. Originals are retained at full resolution and used for
  export.
- Uploads are stored at full resolution; only display variants are generated.
  There is no client-side downscaling or storage re-encode.
- New images default to the Polaroid frame, width 0.44, aspect-derived height,
  rotation −2°, zoom 1, centre focus.
- Image editor:
  - Frame picker; fixed-aspect frames force the crop aspect.
  - Crop ratios: 1:1, 4:5, 3:4, 2:3, 3:2, 4:3, 16:9, Original, and free W/H.
  - Drag to pan focus; wheel/slider zoom 1–4; reset crop.
  - Ten effect presets: Original, Warm, Cool, Vintage, Faded, B&W, Sepia, Vivid,
    Dreamy, Film.
  - Seven sliders: brightness, contrast, saturation, warmth, fade, vignette,
    grain.
  - Custom named presets are shared globally.
  - Album swap and upload from inside the editor.
  - No image-content rotation; only the element rotates.
- Captions are stored and rendered for the legacy `photo` kind and caption-capable
  frames, but there is no caption-editing UI.
- Deleting an album image moves the asset to trash. Elements referencing it are
  not rewritten and can render broken until the image is restored.

### 8.5 Notes

- These are the **scrapbook page-note** controls. The standalone Notes surface
  (§22) reuses the same papers and pens but has its own page, rich text and
  envelope model.
- Seven asset-defined note papers plus a transparent `none` option. The fallback
  is sticky paper. Sticky note is one paper with eight tint options; the former
  Sticky Rose/Sage/Sky papers are tints of it, not separate picker entries.
- Papers support lined/grid/dot rules, sheen, fibre texture, a margin rule, line
  colour, spacing multiplier, radius, shadow, palette, and ordering. Kraft carries
  a visible grain/fibre texture rather than a flat tan fill.
- Rules are computed from font metrics and measured line count so they sit on the
  text baseline at the 480 px page reference.
- Every asset paper accepts a tint; `none` is transparent and ignores it.
- Ten handwriting pens: Caveat, Patrick Hand, Permanent Marker, Caveat Brush,
  Architects Daughter, Homemade Apple, Shadows Into Light, Shantell Sans, Gochi
  Hand, Kalam.
- Controls: size 6–120, line height 1–2.2, ink palette/custom, bold, italic,
  uppercase, shadow, horizontal alignment, vertical alignment, height 0.06–2,
  overall scale 0.2–5.
- Text defaults to centre/middle.
- The inline textarea grows while editing, but the rendered note has a fixed box
  with `overflow: hidden`; there is no auto-fit.
- `none` paper uses auto height and hugs the text.
- The note can be edited inline or from the side panel; both stay in sync.
- Rendered note text is not selectable; text selection works only inside the
  editing textarea.

### 8.6 Stickers, tape, frames, papers

- **Stickers**: 98 asset-defined stickers, flat list with no categories, search,
  favourites, or sets. Add defaults: width 0.18, aspect-derived height, rotation
  −6°.
- Sticker colour is multi-slot (`colors` → CSS variables) with per-slot palettes
  and custom colours. A single-colour `tint` path exists but no shipped sticker
  uses it.
- Stickers flip horizontally like any element.
- **Tape**: two asset-defined tapes (Washi, Masking) with a silhouette mask and
  one colour slot. Add defaults: width 0.42, rotation −4°.
- **Frames**: 15 built-ins plus the asset-defined Stitched frame. A frame is an
  image property, not an element. Capabilities include insets, content aspect,
  radius, background, caption area, circle/arch clipping, sprockets, stacked
  backing sheets, tape/corner mounts, inset ring, shadow, overlay art, and
  recolour slots/presets.
- **Papers**: eight built-in page papers (Cream, Blush, Mint, Sky, Mustard, Kraft,
  Lilac, Charcoal) plus the asset-defined Meadow paper. Meadow has four recolour
  slots and two presets; built-ins have no slots.

### 8.7 Page editor and layers

- The page editor is a right-side panel plus the live page canvas. Desktop only;
  available for unpublished books.
- Palette: add photo, note, sticker, or tape by click (centre/defaults) or drag
  onto the page.
- Selected-element controls: position, size, rotation, opacity, z, lock, aspect
  lock, shadow, flip, name, colour slots/presets, frame/crop/effects, note
  typography, duplicate, delete.
- Undo/redo covers editor mutations; locking excludes an element from transforms.
- **Layers pane**:
  - Page groups are named, collapsible, ordered front-to-back. Default groups are
    Tape, Stickers, Notes, Photos.
  - Add, rename, collapse, move, and delete groups; deleting the last group is
    blocked.
  - Drag elements between groups and reorder them; group order flattens into `z`.
  - Layer rows show a thumbnail, a derived or custom name, lock, and visibility
    of nesting. Rename by double-click.
- Groups are **layer groups**, not transform groups. There is no multi-select,
  group bounding box, group move, or ungroup.

### 8.8 Publish, duplicate, transfer

- `published` is a read-only UI flag on a book. Publishing hides page editing,
  add/manage pages, and unpublish is required to edit again. It is not enforced by
  PocketBase rules or store guards.
- Draft books show a dashed border and "Draft" badge.
- Duplicate is export + import with a " (copy)" title suffix; the copy is created
  in the current folder.
- Book file: `journeybook.book`, version 1. Contains title, cover, pages, elements,
  and per-book media as data URLs. Import re-keys page/media IDs and remaps
  element references. Published state, parent location, order, and tags are not
  preserved.
- Library file: `journeybook.library`, version 1. Contains all nodes, pages,
  elements, media (as data URLs), room, room items, events, layouts, and image
  presets.
- Library import replaces the whole shared library after the user types
  `REPLACE`; current root nodes and events are moved to trash first, the old
  room/items are saved as a “Before import” named layout in trash, and old layouts
  and presets are trashed. Restoring that layout must be applied manually.

## 9. Room

The room is a single shared, illustrated, full-viewport scene behind all content.
Both users see and edit the same room. It is not paged or scrolled.

### 9.1 Stage, bands, and layering

- Fixed wall/floor line: `WALL_LINE = 0.74`.
  - Wall band: `0 → 0.74`.
  - Floor band: `0.74 → 1`.
  - `both`: the whole stage.
- The line is a shared constant used by rendering and the editor. CSS duplicates
  the value (wall 74%, floor 26%, baseboard at `74% - 14px`).
- The stage is fixed, `inset: 0`, `overflow: hidden`, and a size container.
- DOM composition: wall → floor → baseboard → decor items → dust → vignette →
  night/lights layer.
- There is **one absolute `z` scale** across wall, floor, and surface items. The
  layer field does not order rendering. New items and duplicates go on top.
- Attached items render inside their host's DOM, so host rotation, flip, and scale
  cascade. A child's `z` is local to the host's stacking context; the host's `z`
  determines the pair's depth against other items.
- Items with `repeat` tile their art across the band instead of drawing once.

### 9.2 Catalog and sidecar assets

The room catalog is data-driven. Every asset is an SVG in `src/assets/svg/` with a
sidecar JSON of the same base name. Vite eagerly loads `<id>.svg` and `<id>.json`.
A definition may also be a JSON array or embedded `<metadata>` in the SVG; sidecar
fields override embedded ones.

Current inventory:

- **42 room items** + 1 built-in `wall-clock` component.
- Categories: 25 trinkets, 8 furniture, 6 wall decor, 3 pets.
- Layers: 28 surface, 9 floor, 5 wall.
- Bands: 32 floor, 10 wall, 0 both.
- **98 stickers**, **2 tapes**, **1 asset frame**, **1 asset paper**, **7 note
  papers**.

Catalog item contract (see `src/catalog/types.ts`):

```ts
type Layer = 'wall' | 'floor' | 'surface';
type Band = 'wall' | 'floor' | 'both';
type Category = 'wallpaper' | 'flooring' | 'furniture' | 'wallDecor' | 'trinket' | 'pet';

interface CatalogItem {
  id: string;
  label: string;
  category: Category;
  layer: Layer;
  band: Band; // band whose height defines the item's scale
  aspect: number; // width / height
  defaultScale: number; // fraction of band height
  defaultRotation: number;
  art: { day: string; night?: string };
  colorSlots: ColorSlot[];
  attach?: 'furniture' | 'shelf' | 'any';
  host?: boolean; // can hold surface items
  hitbox?: { bottom?: number };
  attachAnchor?: { x: number; y: number }; // default bottom-centre
  component?: 'clock';
  raw?: string; // inlined recolourable SVG
  rawNight?: string;
  effect?: EffectDef | EffectDef[] | null;
  presets?: ColorPreset[];
  animations?: AnimationDef[];
  particles?: ParticleDef[];
  artVariants?: { day?: ArtVariantVisuals; night?: ArtVariantVisuals };
  repeat?: 'x' | 'y' | 'both';
  lights?: LightDef[];
}

interface ColorSlot {
  id: string;
  label: string;
  default: string;
  palette: string[];
  allowCustom: boolean;
}
```

Rules:

- IDs default to the file base name; labels default to the ID.
- `kind` defaults to `room`. The loader also produces `sticker`, `tape`, `frame`,
  `paper`, and `notePaper` definitions.
- Night art is auto-detected as `<id>-night.svg` when not declared.
- When both day and night art exist, their viewBoxes are merged into one shared
  frame so the swap causes no layout shift. Per-variant `scale` and `artAnchor`
  reconcile differences; the union determines `aspect`.
- An item with non-empty `colorSlots`, or `raw: true`, is inlined so slot colours
  can be substituted. Repeat art is recoloured and baked into a data URL.
- Missing night art falls back to day, and vice versa.
- `wallpaper` and `flooring` exist in the type but no catalog assets exist; walls
  and floors are separate preset options (§9.9).
- Hosts and attaching items are mutually exclusive: an item cannot both host and
  attach.

Sidecar authoring is described by the `room-decor-json` skill and checked by
`src/catalog/loadDecor.spec.ts` and `src/catalog/roomDecorSkill.spec.ts`.

### 9.3 Hosts and attachment

- A host is a catalog item with `host: true` that is not itself a `surface` item.
- Only `surface` items can attach. A non-surface item can never attach.
- Attach rules:
  - `attach: 'shelf'` requires a host in the `wallDecor` category.
  - `attach: 'furniture'` and `attach: 'any'` accept any compatible host.
- Current hosts: desk, short/medium/tall shelves, large/medium wall shelves,
  beanbag, bedside table, corkboard, circular rug, rectangle rug, and the window.
- Rugs host surface trinkets; the window and wall shelves can host items such as
  mugs. The curtain is not a host.
- Attached placement is stored as `ax`/`ay`, fractions of the host box, plus the
  placement's own rotation/scale/flip. The child uses its **attach anchor**
  (default bottom-centre) rather than the grab point.
- Flipping a host mirrors the child's anchor X only, not Y.
- Dragging an attached child moves `ax`/`ay` within the host. Moving the anchor
  outside the host by more than ±0.02 detaches it, preserving its on-screen
  centre and its own rotation.
- Dropping a loose surface item over a valid host attaches it at the projected
  host-local cursor.
- Deleting a host first detaches its children while preserving their on-screen
  centres, then removes the host.
- `hitbox.bottom` extends the item's invisible hit area below the art in edit
  mode; the window uses it so a curtain can be grabbed below the sill.
- Resizing/scaling a host scales its attached children. An attached child's size
  is a fraction of the host box.

### 9.4 Placement, size, and transforms

```ts
interface Placement {
  x: number; // fraction of stage width (loose) or host box (attached)
  y: number; // fraction of band height from the top (loose)
  scale: number; // fraction of the position band's height
  rotation: number; // degrees
  flip: boolean; // horizontal mirror
  ax?: number; // attached: fraction across the host box
  ay?: number; // attached: fraction down the host box
}
```

- Loose items are positioned by their **bottom** at
  `band.top + y * band.height`; `left` is `x` percent of stage width.
- Item height is `scale * bandHeight`; width is `height * aspect`.
- Width/height use container-query height units (`cqh`), so items scale with the
  stage.
- Loose `surface` items position against the whole stage but size against their
  catalog band, so they can be dragged anywhere while keeping authored size.
- Transform: `translateX(-50%) rotate(deg) scaleX(±1)`, origin `50% 50%`.
- Attached children compose host centre, host rotation, host flip, child anchor,
  and child rotation. Total rotation is `host.rotation ± child.rotation`; total
  flip is XOR.
- Loose drag clamps `x` to 0.02–0.98 and `y` to 0–1. Attached `ax`/`ay` clamp to
  0–1. Resize clamps scale to 0.03–4.
- There is no global "keep the whole item on screen" clamp, collision resolution,
  snapping, alignment, or auto-arrangement. Wide items can overhang the stage.
- Keyboard nudge: 0.005 per press, 0.02 with Shift, clamped to 0–1.

### 9.5 Day and night

- Modes: `auto`, `day`, `night`. Manual `day`/`night` override auto until cleared.
- Auto uses fixed daylight hours **07:00 ≤ local hour < 19:00** in the room's
  `referenceTz` (default `America/Chicago`). It does **not** use real sunrise/
  sunset.
- Auto is evaluated at render time; there is no timer that flips the room at
  07:00/19:00 while it stays open. A re-render or relevant state change
  re-evaluates it.
- Missing art variants fall back to the available one.
- Day/night swaps are layout-stable (§9.2).
- The `wall-clock` item is independent of `referenceTz`: it always shows
  America/Chicago (pink hand) and America/New_York (blue hand), with the shared
  minute hand.
- Night mode changes room ink tokens to cream tones. It is room ambience, not an
  app-wide dark theme; cards and pages stay paper-coloured. The app declares
  `color-scheme: light`.

### 9.6 Lighting

- Default renderer is a canvas lightmap:
  - A darkness pass fills the stage with ambient night colour and punches
    light-shaped holes with `destination-out`.
  - A glow pass draws additive coloured pools with `lighter`, blended with CSS
    `screen`.
- Ambient constants: colour `rgb(34, 33, 58)`, night alpha 0.64, particle light
  radius 0.05 of stage, ~30 fps, DPR capped at 2.
- Night fades in/out over ~0.6 s with exponential smoothing. Light intensity and
  ambient alpha are multiplied by `nightAmount`.
- The animation loop runs while settling, editing, or while a flickering light or
  lit particle exists; otherwise it stops. It pauses when the document is hidden
  and redraws on resize/visibility.
- Fixture types and defaults:

| Type      | Radius | Intensity | Flicker | Colour    |
| --------- | ------ | --------- | ------- | --------- |
| `lamp`    | 300    | 1         | 0.05    | warm      |
| `candle`  | 180    | 0.72      | 0.4     | `#ffb066` |
| `firefly` | 90     | 0.5       | 0.55    | `#ffd76b` |
| `string`  | 120    | 0.55      | 0.18    | `#ffd9a0` |
| `window`  | 380    | 1.05      | 0       | `#cfe0ff` |
| `screen`  | 240    | 0.8       | 0.04    | `#bfe3ff` |
| `moon`    | 320    | 0.55      | 0       | `#dfe6ff` |

- Distributions: `point`, `semi`, `diffuse`, `spot`, `wash`, `ambient`. Each has
  its own falloff stops and gain. `spot` defaults to a 55° cone with 0.35
  penumbra; `wash` to 150° with 0.75.
- Light position and radius are percentages of the item box. Intensity is
  `def.intensity × type.intensity × item.lightLevel × distribution.gain`.
- Colour comes from a bound colour slot when `slot` is set, otherwise the literal
  or type default.
- Explicit `lights` win over a synthesized glow. If an item has a `glow` effect
  and no explicit lights, one lamp light is synthesized at 50/50 using the glow
  colour/slot.
- Attached lights use the host frame and child anchor, including host rotation
  and flip.
- `repeat` items can tile lights, with the tile count derived from stage aspect.
- Particles marked `light: true` emit live point lights read from DOM positions
  every frame.
- The editor exposes a brightness slider (0–2) for any item that emits light.
- Performance mode (`?perf=1`, or Settings) replaces the canvas with a CSS night
  overlay plus screen-blended item clones. See §18 for its current limitation.

### 9.7 Effects, animation, and particles

- Whole-object animations are data-defined CSS keyframes, hashed and injected
  once into a single `<style>` element.
- Defaults: duration 4 s, timing ease-in-out, delay 0, direction normal,
  iterations infinite, fill both.
- Multiple animations are nested one wrapper per animation, so transforms
  compose.
- Resolution order: legacy recipes → item-level animations/particles → current
  time-of-day variant animations/particles.
- Legacy recipes:
  - `sway`: rotate ±2° (default), 4 s, origin bottom or top.
  - `float`: translateY ±4 px (default), 5 s.
  - `flicker`: stepped opacity flicker, 2.4 s.
  - `twinkle`: opacity 0.45↔1, 3 s.
  - `glow`: night-only bloom, default `#ffd88a`, 3 s, optional slot binding.
  - `smoke`: particle puff, 1–8 particles (default 3), 3.6 s.
- Particle defaults: count 3 (clamped 1–24), duration 3.4 s, staggered, size 16%
  of item box, spawn 50/4, opacity 1, default rise-and-fade.
- Particle shapes may be circles or SVGs. With a colour, the SVG is used as a
  tinted mask; optional blur.
- Jitter is deterministic, seeded by item ID plus particle name/index, so
  re-renders do not reshuffle.
- `prefers-reduced-motion: reduce` suppresses all animations, particles, bloom,
  and particle lights, plus CSS dust and transitions.
- Ambient dust motes are CSS-only and hidden under reduced motion and in embedded
  (mobile preview) stages.

### 9.8 Shadows

- Default drop-shadow by category:
  - Trinkets, furniture, wall decor, pets: 0.5.
  - Desk and all shelves: 0.8.
  - Postcards and rugs: none by default.
- Per-item `shadow` overrides 0–1; 0 means none.
- Rendering is a silhouette `drop-shadow` filter, skipped for repeat items.
- Resting categories (trinket, furniture, pet) also get an oval contact shadow
  whose width and opacity scale with the amount.
- The contact-shadow wrapper counter-rotates and counter-flips against the item
  and host pose so the shadow stays level.
- There is no directional/cast-shadow engine.

### 9.9 The room editor

- **Entry**: Settings → Edit room. Desktop only; the row is hidden on mobile.
  There is no in-room edit button.
- **Draft model**: entering clones the room and items into a draft, pauses
  realtime sync, starts undo history, and loads named layouts.
- **Dirty/save**: Done closes immediately if clean; otherwise it offers Save,
  Discard, and Save as. Save replaces the global room and all items. Discard
  leaves app data untouched. A browser close/refresh warns while dirty.
- **Named layouts**: listed in the panel; Load replaces the draft and marks it
  dirty; Delete is permanent after confirmation.
- **Selection**: click an item or a list row. Clicking empty room or content
  deselects. Repeated clicks within 6 px cycle through overlapping items
  front-to-back.
- **Move**: loose `x`/`y`; attached `ax`/`ay` with attach/detach preview badges.
- **Resize**: bottom-right handle; loose resize keeps aspect and fixes the
  opposite corner; attached resize works in host-local axes.
- **Rotate**: top handle around the item centre; attached rotation converts the
  screen angle into host-local rotation.
- **Flip**: horizontal only, per current viewport placement; mirrors the attach
  anchor.
- **Duplicate**: deep clone with a new ID, top `z`, `x + 0.05`, selected. Attached
  children are not cloned.
- **Delete**: button or Delete/Backspace. Locked items cannot be deleted. Deleting
  a host detaches children first.
- **Clear room**: removes every item; undoable. It does not reset wall/floor/day-
  night.
- **Lock**: blocks move/resize/rotate/nudge/delete/reorder and hides handles. It
  does not block duplicate, colour/preset changes, depth, shadow, light level,
  hide-mobile, or unlocking.
- **Depth**: single absolute 0–60 slider and number. The list is front-to-back;
  drag rows to reorder within the same parent group, which reassigns sequential
  `z`. There is no cross-host or mixed top-level reorder.
- **Colour**: per-slot palette swatches, multi-slot presets, and a custom picker
  where `allowCustom` is true. Item values fall back to slot defaults. Raw SVGs
  use CSS variables; repeat art is baked.
- **Environment**: 5 wall presets, 13 floor presets, day/night mode, free-text
  IANA timezone, catalog palette, and named layouts.
- **Catalog palette**: grouped into Furniture, Wall decor, Items, Pets. Click or
  Enter/Space adds at the centre; dragging places at the pointer. Dropping over
  the panel cancels. Dropping a surface item over a host attaches it.
- **Undo/redo**: 100 full-draft snapshots. Cmd/Ctrl+Z undo; Cmd/Ctrl+Shift+Z or
  Ctrl+Y redo. New edits clear the redo stack.
- **Keyboard**: Delete/Backspace removes; arrows nudge. Shortcuts are ignored in
  inputs, textareas, and contenteditable.
- **Panel**: dock left or right and collapse; preference persists in
  `journeybook:editor-ui:v1`. Default right/expanded.
- No multi-select, grouping, copy/paste, alignment/distribute, snapping, grid,
  duplicate shortcut, Escape-to-deselect, or reset-environment action.

### 9.10 Desktop and mobile layouts

- Every item always has a `desktop` placement. `mobile` is optional.
- On mobile, `mobile` is used when present; otherwise a derived placement copies
  `y`, `scale`, `rotation`, and `flip`, and clamps `x` to 0.08–0.92.
- `hideMobile` removes the item on mobile when not editing. In the editor's
  mobile preview it stays visible, dimmed and dashed.
- A hidden host hides its attached children on mobile even if a child is not
  hidden.
- Editing in mobile view creates an explicit `mobile` placement from the derived
  one and mutates that. There is no `autoPlaced` flag or "reset to auto" action.
- Mobile preview is a scaled 410×864 phone frame (`min(1, availW/410,
availH/864)`) with a 340 px open panel or 46 px collapsed panel.
- While editing, the main canvas is desktop unless the mobile preview replaces it.

### 9.11 Default room and layouts

- A new library starts with an **empty room**: default wall `stripes-cream`,
  floor `wood-warm`, mode `auto`, timezone `America/Chicago`, zero items.
- No demo content ships. The rich room in `e2e/library.json` is a test fixture.
- Named layouts store `{ name, room, items }` and can be loaded into the draft.
- `wallId` and `floorId` select presets from `src/catalog/options.ts`; unknown IDs
  fall back to the first preset.

## 10. Calendar

### 10.1 Model

```ts
type EventKind = 'visit' | 'anniversary' | 'birthday' | 'occasion';
type VisitDirection = 'to-her' | 'to-me' | 'together';
type Recurrence = 'none' | 'yearly' | 'monthly' | 'weekly';

interface CalendarEvent {
  id: string;
  kind: EventKind;
  title: string;
  notes?: string;
  startsAt: string; // ISO UTC
  endsAt?: string; // visits only
  direction?: VisitDirection;
  flights?: FlightLeg[];
  recurrence: Recurrence;
  showBeforeStart?: boolean; // recurring: also show dates before startsAt
  color?: string; // stored but unused
}

interface FlightLeg {
  id: string;
  label?: string;
  airline?: string;
  flightNo?: string;
  from?: string;
  to?: string;
  depart: string; // ISO UTC
  arrive: string; // ISO UTC
  tz?: string; // display-only label, not rendered
}
```

### 10.2 Behaviour

- Visits are one-time windows. They define "together now" and the countdown.
- Anniversaries, birthdays, and occasions may recur yearly, monthly, or weekly.
  Recurrence preserves the original duration and uses the browser's local
  timezone; range expansion caps at 500 occurrences.
- Recurring events also have an initial date (`startsAt`). Occurrences before it
  are hidden unless **Show occurrences before the initial date** is enabled.
- Recurring titles are numbered from the initial date only where the title
  contains an unescaped placeholder. `%` inserts the number (`21`), `%%` inserts
  the number with its suffix (`21st`). The first occurrence starts at `0` unless
  digits follow the sign(s) immediately: `%%21 Birthday` → `21st Birthday` first,
  then `22nd`, `23rd`… `\%` renders a literal `%`; `\\` renders a literal
  backslash. If early occurrences are enabled, numbers count backward from the
  initial date (`-1st`, `-2nd`).
- No RRULE, exception dates, every-N-weeks, or end-of-month special handling.
- Visit direction is rendered from the signed-in user's perspective using role
  and partner name ("I go to her", "she comes to me", "we meet").
- Event dialog:
  - Common: kind, title, notes.
  - Visit: direction, arrive/meet datetime, optional until, optional multiple
    flight legs (airline, flight number, from/to, depart/arrive, free-text
    timezone label).
  - Non-visit: one-time datetime or recurrence plus date.
  - Recurring only: **Show occurrences before the initial date** (default off).
    A short `%` / `%%` hint sits under the title, with an `(i)` button that
    expands the full numbering and escape rules.
  - Visits are forced to `recurrence: 'none'`.
  - Title and a date/time are required.
- Month grid: fixed 42 cells, weeks start Sunday, three chips per day, coloured
  by kind, recurring events ringed. Outside-month, today, and selected states.
  Month label click jumps to today.
- Desktop: month card plus a right pane with the selected day and "Coming up"
  (auto-reduces the list to fit, max 8).
- Mobile: three horizontally sliding screens — month, day, upcoming. Only the
  day/upcoming panes scroll.
- Togetherness: banner shows together, apart with a countdown, or "No visits
  planned yet". Upcoming horizon is two years; the calendar requests 60 entries.
- Times display in the browser's local timezone. There is no timezone selector,
  and the room's `referenceTz` is not used by the calendar.
- The room bar countdown refreshes every 30 s; the calendar uses a 30 s clock.
- Adding and editing remain available on mobile.
- Deleting an event moves it to trash.

## 11. Settings

Desktop unless noted:

- **Time of day**: Day / Night / Auto; writes the shared `room.dayNightMode`.
  The subtitle says "where you are", but Auto uses the shared `referenceTz`.
- **Performance lighting** (all devices): per-browser toggle that swaps the
  canvas lightmap for the CSS fallback. Persisted in
  `localStorage['journeybook:performance']`; `?perf=1`/`?perf=0` overrides it.
- **Room text glow** (all devices): per-user slider from 0 (no glow) to 100
  (solid), with a floating preview shown while the slider is being used. The
  preview is a mini room with the current wall and a centred window behind the
  sample text. It controls the wall-coloured halo behind text that sits directly
  on the room, and only applies in day mode. The default is `0.92`, matching the
  original fixed halo. In PocketBase mode the value is stored on the signed-in
  user's `roomGlow` field; local mode (and signed-out use) falls back to
  `localStorage['journeybook:room-glow']`.
- **Edit room** (desktop): enters the room editor.
- **Trash**: lists soft-deleted books, pages, media, events, layouts, and presets;
  restore, delete permanently, or empty all. Shared between both users.
- **Backup**: export the whole library (`journeybook.library`) or import one after
  typing `REPLACE`.
- **Library check**: counts orphan pages, elements, and media; "Clean up" deletes
  orphan pages/elements and trashes orphan media.
- Mobile shows only time of day, performance lighting, and room text glow.
- There is no theme picker, timezone selector, account/profile editor, password
  change, avatar upload, notification setting, privacy setting, or About section.
- Account identity and Sign out live in the room bar account menu.

## 12. Data model (application types)

The canonical types live in `src/data/types.ts`. Core shapes:

```ts
type CoverColor = 'rose' | 'sage' | 'mustard' | 'terracotta' | 'sky' | 'kraft';
type NodeType = 'folder' | 'scrapbook';

interface ScrapNode {
  id: string;
  type: NodeType;
  title: string;
  parentId: string | null;
  tags: string[];
  order: number;
  cover?: CoverColor;
  published?: boolean;
}

interface ScrapPage {
  id: string;
  bookId: string;
  index: number;
  background?: string;
  paperColors?: Record<string, string>;
  groups?: PageGroup[];
}

interface PageGroup {
  id: string;
  name: string;
  collapsed?: boolean;
}

interface MediaAsset {
  id: string;
  bookId: string;
  name: string;
  fileName?: string; // PocketBase file name
  created: number;
}

interface ImagePreset {
  id: string;
  name: string;
  effects: ImageEffects;
  deletedAt?: number; // absent/0 = live
}

interface Room {
  wallId: string;
  floorId: string;
  dayNightMode: 'auto' | 'day' | 'night';
  referenceTz: string;
}

interface RoomItem {
  id: string;
  catalogId: string;
  layer: 'wall' | 'floor' | 'surface';
  z: number;
  attachTo?: string;
  color: Record<string, string>;
  desktop: Placement;
  mobile?: Placement;
  hideMobile?: boolean;
  locked?: boolean;
  lightLevel?: number;
  shadow?: number;
}

interface StoredLayout {
  id: string;
  name: string;
  room: Room;
  items: RoomItem[];
  deletedAt?: number; // absent/0 = live
}

interface AppData {
  version: number; // currently 1
  content: { nodes: ScrapNode[]; pages: ScrapPage[]; elements: PageElement[]; media: MediaAsset[] };
  room: Room;
  roomItems: RoomItem[];
  events: CalendarEvent[];
}
```

Notes are **not** part of `AppData`; they are stored under their own local key
and PocketBase collection so drafts can stay private. Types:

```ts
interface RichRun {
  text: string;
  font?: string; // NOTE_FONTS id
  size?: number; // logical px at the 480-wide page
  color?: string; // hex
  highlight?: string; // hex
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

interface RichBlock {
  align: 'left' | 'center' | 'right';
  runs: RichRun[];
}

interface RichDoc {
  v: 1;
  blocks: RichBlock[];
}

interface NoteEnvelope {
  tint: string; // hex, preset or custom
  seal: string; // hex, wax seal art colour, preset or custom
  stamp: string; // stamp colour preset id
  stampPaper?: string; // custom stamp colour hex, overrides the preset
  stampWaves?: string; // custom postmark colour hex, overrides the preset
  initial?: string; // author's first initial pressed into the seal
}

interface Note {
  id: string;
  authorId: string;
  recipientId: string;
  status: 'draft' | 'sent';
  body: RichDoc;
  paper: string;
  paperColor?: string;
  pageHeight: number; // 380–1100 logical px at a fixed 480 width
  envelope: NoteEnvelope;
  createdAt: number;
  updatedAt: number;
  sentAt: number;
  openedAt: number;
  emailedAt: number;
  deletedAt?: number;
}
```

`TrashKind` includes `'note'`. A page note (`NoteElement`, §8.5) is still a
plain-text scrapbook element; it is unrelated to a `Note` letter.

## 13. PocketBase schema

Most collections use the rule `@request.auth.id != ""` for list, view, create,
update, and delete. `users` is auth-only; `notes` adds per-user rules (below).
Otherwise there is no per-owner filtering. Relationships are plain text IDs, not
relation fields, and there are no custom indexes, uniqueness constraints, or
foreign keys.

| Collection      | Fields                                                                                                                                                                                                                                 | Notes                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `users` (auth)  | `name` (text 80), `role` (`him`/`her`), `roomGlow` (text 0–1), auth fields                                                                                                                                                             | list/view authenticated; create/delete null (no signup); update only own record.  |
| `nodes`         | `type` (`folder`/`scrapbook`), `title` (200), `parent` (20), `tags` (JSON), `order` (number), `cover` (20), `published` (bool), `deletedAt`                                                                                            | Tree via text `parent`.                                                           |
| `pages`         | `book` (20), `index` (number), `background` (40), `groups` (JSON), `paperColors` (JSON), `deletedAt`                                                                                                                                   |                                                                                   |
| `elements`      | `page` (20), `kind` (`photo`/`note`/`sticker`/`image`/`tape`), `payload` (JSON), `x`, `y`, `w`, `h`, `rotation`, `z`, `opacity`, `locked`, `aspectLocked`, `group` (40), `name` (120), `scale`, `deletedAt`                            | `payload` holds the full element; columns are fallbacks.                          |
| `room`          | `wallId` (40), `floorId` (40), `dayNightMode` (10), `referenceTz` (60)                                                                                                                                                                 | Fixed-ID singleton + API create guard; not a DB uniqueness constraint.            |
| `room_items`    | `catalogId` (60), `layer` (`wall`/`floor`/`surface`), `z`, `attachTo` (20), `color` (JSON), `desktop` (JSON), `mobile` (JSON), `hideMobile` (bool), `locked` (bool), `data` (JSON)                                                     | `data` preserves fields without a column (`lightLevel`, `shadow`).                |
| `room_layouts`  | `name` (120), `data` (JSON), `deletedAt`                                                                                                                                                                                               | `data` = `{ room, items }`.                                                       |
| `media`         | `book` (20), `name` (200), `file` (single, 25 MB, Protected), `deletedAt`                                                                                                                                                              | MIME: JPEG, PNG, WebP, GIF, AVIF. Thumbs `480x480`, `1200x1200f`; token required. |
| `image_presets` | `name` (120), `effects` (JSON), `deletedAt`                                                                                                                                                                                            | Shared globally.                                                                  |
| `events`        | `kind` (20), `title` (200), `data` (JSON), `deletedAt`                                                                                                                                                                                 | Full event in `data`; no queryable date column.                                   |
| `notes`         | `author` (20), `recipient` (20), `status` (10), `body` (JSON), `paper` (40), `paperColor` (20), `pageHeight` (number), `envelope` (JSON), `createdAt`, `updatedAt`, `sentAt`, `openedAt`, `emailedAt`, `emailLastAttempt`, `deletedAt` | Private drafts; sent letters shared. Rules below.                                 |
| `trash`         | `kind` (20), `label` (200), `detail` (120), `records` (JSON), `deletedAt`                                                                                                                                                              | `records` is refs; local mode stores snapshots.                                   |

Migrations are numbered `1700000001`…`1700000018`. `1700000010` is an idempotent
repair pass for fields that older PocketBase versions recorded as applied without
adding. `1700000013` introduces soft deletes and `trash`. `1700000014` adds media
thumbnails. `1700000016` adds `notes`; `1700000017` adds the email retry
bookkeeping; `1700000018` protects media files. PocketBase applies migrations
automatically on container start.

Notes rules:

- list/view: `@request.auth.id != "" && (author = @request.auth.id || (status = "sent" && recipient = @request.auth.id))`
- create: `@request.auth.id != "" && @request.auth.id = author`
- update: authenticated and either the author or the sent letter's recipient
- delete: the author only

The update rule is coarse because PocketBase has no per-field rules.
`notes.pb.js` (with shared helpers in `notes-lib.js`) rejects content-field
changes from the recipient; only `openedAt` (and the `updatedAt` bookkeeping
written with it) is accepted. After the recipient opens a letter, it also rejects
all author changes except `deletedAt`, so the UI lock is backed by the server.

`server/pb_hooks/` adds:

- A daily 03:00 PocketBase backup (14 retained) if no schedule exists.
- A daily 04:00 hard purge of trash entries and referenced records older than 30
  days.
- A best-effort note notification email after a note becomes `sent`, using the
  PocketBase mail settings and `meta.appURL`; a 15-minute cron retries failures
  with a cooldown; see §17.5.
- A room singleton guard that rejects a second `room` row.
- The media collection is Protected; `/api/files/...` requires a short-lived file
  token.

Hook callbacks are isolated by PocketBase, so reusable helpers live in a
CommonJS module (`notes-lib.js`) and are required inside each callback.

## 14. Persistence, sync, trash, and integrity

### 14.1 Local mode

Keys:

| Key / store                             | Contents                               |
| --------------------------------------- | -------------------------------------- |
| `journeybook:v1`                        | Full `AppData` document.               |
| `journeybook:layouts:v1`                | Named room layouts.                    |
| `journeybook:image-presets:v1`          | Custom image presets.                  |
| `journeybook:trash:v1`                  | Trash entries with record snapshots.   |
| `journeybook:notes:v1`                  | Note letters and drafts.               |
| `journeybook:notes:v1.corrupt:<ts>`     | Quarantined unreadable notes payload.  |
| `journeybook:outbox:v1`                 | Pending writes (unused in local mode). |
| `journeybook:performance`               | Performance-lighting preference.       |
| `journeybook:room-glow`                 | Local/signed-out room text glow (0–1). |
| `journeybook:editor-ui:v1`              | Editor dock/collapse preference.       |
| IndexedDB `journeybook-media` / `blobs` | Media bytes keyed by asset ID.         |

- `saveData` throws on storage failure (for example quota); the app toasts.
  Note saves throw only from the local backend's note write; the notes store
  surfaces load/write failures with a toast.
- Layout, preset, and trash saves swallow errors.
- Object URLs for local media are revoked when media is purged or no longer in
  the live library; restoring rehydrates them from IndexedDB.
- Local trash expires after 30 days, matching the server purge. Expiry also
  removes photo bytes, notes, layouts and presets held by those entries.

### 14.2 PocketBase mode

- Reads fetch all live records on boot and on realtime refresh.
- Writes are optimistic and queued in a persistent FIFO outbox.
- Outbox operations: `create`, `update`, `upsert`, `delete`, `updateFirst`,
  `deleteNode`, `applyRoomLayout`, `trashGroup`. Notes use `create`/`update`;
  marking a letter opened uses a targeted `update` containing only `openedAt` and
  `updatedAt` so it cannot rewrite the letter.
- Retries use exponential backoff from 1 s to 30 s and reset after success. The
  queue resumes on module load and on `online`.
- Coalescing: update folds into a pending create; latest update wins; create+
  delete cancels; update+delete becomes delete; `updateFirst` collapses per
  collection. `applyRoomLayout` and `trashGroup` are not coalesced.
- Creates are replay-safe: if a create succeeded but its response was lost, the
  retry updates the existing record. Deletes treat a missing record as already
  done. A create followed by a lost response therefore cannot wedge on a
  duplicate ID, including a sent note.
- After five consecutive permanent errors (validation/permission, excluding
  auth/network throttling), the write leaves the live queue for a persisted
  dead-letter lane. Later writes continue. Settings → **Unsynced changes** shows
  the count with **Retry** and **Discard** actions; nothing is silently dropped.
- Media uploads, trash restore/purge, and all reads bypass the outbox.
- The UI shows a sync pill: "Saving… N", "Reconnecting… N unsaved", or
  "N unsynced changes".
- While online, every successful full fetch, notes fetch, trash load, layout
  load and preset load updates a `journeybook:remote-snapshot:v1` fallback.
  Remote mode uses that snapshot (data, current account's notes, trash, layouts
  and presets) if the API is unreachable, showing an **Offline copy** pill instead
  of the blocking load-error gate. The snapshot is cleared on logout. A production
  service worker caches the app shell/static assets (never `/api`, `/_` or
  protected media), so an offline reload can reach the cached app and snapshot.
- Notes refresh through their own subscription. The notes store skips realtime
  refreshes while a composer is open or writes are queued, then catches up when
  the composer closes.
- If boot requests return **401**, the app clears the stale auth session, remote
  snapshot and service-worker shell cache, then reloads to the login screen. The
  load-error screen also offers **Reset local copy**, which performs the same
  browser-only reset without touching server data. This recovers tabs left with
  stale sessions or cached shells after a deployment.

### 14.3 Trash

- Soft delete is `deletedAt` (epoch ms, 0 = live) on nodes, pages, elements,
  media, events, room_layouts, image_presets, and notes.
- Deleting a book/folder collects descendant nodes, pages, elements, and media
  into one trash entry.
- Deleting a page collects the page and its elements.
- Deleting an album photo also collects every placed image element that uses it
  into the same trash entry, so pages cannot keep a missing-photo reference.
- Elements removed inside the page editor and room items are hard-deleted. Named
  layouts and image presets are soft-deleted into trash and restore from Settings;
  Notes are soft-deleted only by their author. A local note restore un-deletes the
  stored record.
- Restore un-deletes referenced records. Purge deletes them permanently. A daily
  server hook and local startup purge entries older than 30 days; local expiry also
  removes the associated bytes/notes/layouts/presets.
- Local restore re-adds snapshotted records and de-dupes by ID.
- Trash is shared and has no attribution.

### 14.4 Integrity and transfer

- Integrity audit counts orphan pages (missing book), orphan elements (missing
  page), orphan media (missing book), placed images with a missing photo, and
  attached room items with a missing host. It also counts notes whose author or
  recipient account no longer exists. It does not check duplicate indexes,
  invalid paper/frame IDs, layouts, or event data.
- Clean-up deletes orphan pages/elements, trashes orphan media, detaches dangling
  room attachments, and moves orphaned notes to the trash.
- Library export/import is destructive and requires `REPLACE`.
- Library import validates the required shape, re-keys every node/page/element/
  media/event/layout/preset, rewrites parent/page/media/preset/attachment
  references, validates asset IDs, and skips elements that cannot resolve. Media
  therefore cannot collide with live or soft-deleted record IDs. Before replacing
  the room, the old room/items are saved as a named “Before import” layout and old
  layouts/presets are trashed; restoring the layout is a manual apply.
- Book import re-keys pages/media/elements, validates page and media references,
  and drops an image element whose bytes could not be imported.
- Notes are deliberately excluded from both library and book export. There is no
  per-user notes export yet (§18).

## 15. Visual design, responsive rules, and accessibility

### 15.1 Design tokens

| Token          | Value                 | Use                           |
| -------------- | --------------------- | ----------------------------- |
| `--paper`      | `#f7efdd`             | Page background base          |
| `--paper-2`    | `#f1e5cd`             | Secondary paper               |
| `--card`       | `#fcf7ec`             | Cards, buttons                |
| `--cream`      | `#fbf6ec`             | Light surfaces                |
| `--ink`        | `#4a3b2e`             | Primary text                  |
| `--ink-2`      | `#6f5c49`             | Secondary text                |
| `--ink-soft`   | `#9a8770`             | Tertiary text                 |
| `--kraft`      | `#d3b184`             | Folders                       |
| `--rose`       | `#d98c8c` / `#e8b4af` | Primary accent                |
| `--sage`       | `#9caf88` / `#7e8f6b` | Secondary accent              |
| `--mustard`    | `#d9a94e`             | Search/highlight, warm accent |
| `--terracotta` | `#c97b5a`             | Warm accent                   |
| `--sky`        | `#9dbfc9`             | Cool accent                   |

- Radius 14 px; three warm, low-contrast shadow levels.
- Fonts: Fraunces (serif headings), Nunito (body), Caveat (handwriting accents).
  Handwriting pens are used only inside notes.
- Texture: paper grain, torn/stitched borders, washi tape, paper clips, pressed
  flowers, doilies.
- Buttons are deliberately rotated/dashed, with alternating rotations for a
  hand-placed feel.
- Night mode swaps only room ink tokens; it is not a theme switch.

### 15.2 Room visual composition

- Striped wallpaper over a plank wood floor, baseboard, soft vignette.
- Wall decor can include a window with sky/sun/clouds, linen curtains, string
  lights, a live wall clock, a trinket shelf, and a corkboard of postcards.
- Foreground can include a 3D wooden desk with backsplash, laptop, mug, pencil
  cup, scissors, bottle, plant, a rug, and a bean bag with a sleeping raccoon.
- The composition is data-driven and empty by default; the above is the intended
  vocabulary, not guaranteed seed content.
- On mobile the same stage is used; only placements differ. The desktop-authored
  layout is derived/clamped rather than re-composed.

### 15.3 Breakpoints and layout

- Mobile breakpoint: 760 px.
- Book spread requires 720×340; otherwise single page.
- Content bottom reserve: 26 vh desktop, 14 vh mobile.
- Settings overrides the reserve and is a full-height scroller.
- Desktop organizer: two rows, horizontal scroll, arrowheads. Mobile: full-bleed
  swipeable shelf.
- Mobile calendar: three sliding screens; only inner panes scroll.
- No vertical page scroll anywhere.

### 15.4 Motion

- `prefers-reduced-motion: reduce` disables room particles/animations, dust,
  calendar slide transitions, and toast transitions.
- It does not cover the light pulse or every hover transition. Coverage is
  partial (see §18).

### 15.5 Accessibility

- Body copy uses Nunito at comfortable sizes; handwriting is accent-only.
- Interactive elements get a visible `:focus-visible` mustard outline.
- Tap targets should be ≥ 44 px on mobile.
- Decorative art should be `aria-hidden`; meaningful art should carry a label.
  Current icon call sites are inconsistent.
- Dialogs are custom overlays. The room/page editor exit dialogs declare
  `role="dialog"`; the calendar event dialog does not. There is no focus trap,
  autofocus, or consistent Escape handling.
- Pinch zoom is disabled and text is non-selectable outside inputs, which is an
  accessibility trade-off.
- Toasts use `role="status"`; there is no explicit `aria-live` or toast limit.
- Notes: the letter editor is a labelled contenteditable textbox; paper,
  typography and envelope controls are labelled buttons/selects. Overflow is
  shown in red **and** announced by a text meter / warning, so colour is not the
  only signal. The send confirmation declares `role="dialog"` but, like the other
  dialogs, has no focus trap. The mobile style sheet has a visible Done action.

### 15.6 Art assets

- All art lives in `src/assets/svg/`, one asset per file, named in kebab-case.
  Design mockups remain in `design/assets/svg/`.
- Room decor is SVG + JSON sidecar. Scrapbook stickers, tapes, frames, papers, and
  note papers use the same loader with a different `kind`.
- Art provided by the user is source of truth and must not be recoloured or
  cleaned without asking.

## 16. Verification

A task is not done until these pass:

- `pnpm typecheck` (`vue-tsc --noEmit`)
- `pnpm lint` (ESLint)
- `pnpm format` (Prettier check)
- `pnpm test` (Vitest)
- `pnpm test:e2e` (Playwright) when a flow is affected

Rules:

- Add or update tests for new behaviour. Unit/component tests use Vitest + Vue
  Test Utils; critical flows use Playwright.
- Never claim something works without running the relevant checks. If a check
  cannot be run, say so and why.
- Current coverage: 39 Vitest spec files and two Playwright files. Data-safety
  coverage includes outbox replay/dead-letter behaviour, idempotent creates,
  import re-keying and dangling-reference validation, room attachment/photo
  referential cleanup, local trash expiry, remote snapshot/offline fallback,
  tokenised media URLs and note/room integrity. New notes coverage:
  rich-text sanitisation/round-trip, envelope/page helpers, the seal
  initial, the local notes store (draft/send/unsend/open/trash/restore), and a
  local-mode Playwright flow covering compose → draft → send → outbox → read →
  pull back (including the G seal initial), plus mobile Home and composer-bar
  checks: the compact covers stack, stay at most 300 × 130 px, and clear the Notes
  label, every composer control stays on one non-overflowing row at 390 px
  through the draft and sent-unopened states, draft cards show only the paper’s
  first line and an edited timestamp without per-card Draft labels or a duplicate
  preview, the settings panel has no Page
  section while the paper grip remains present, the picker exposes seven labeled
  tintable papers with one Sticky note and zoomed-out preview patterns, Kraft’s
  texture renders on the page and preview, custom paper/ink/envelope/seal/stamp colours are
  applied, a collapsed caret accepts font, size, ink and bold for the next text,
  the paper and red overflow use the full shell height, the desktop settings
  sidebar stays content-sized, the mobile sheet remembers its Paper/Pen tab in a
  compact tabs/Done header with stable Paper/Pen sheet height, the mobile envelope
  panel stays open and compact with no Done/hints, the envelope border encloses
  the full rectangle and the wax seal is prominent, the Stamp/Postmark labels and
  custom pickers are present, the Style button and mode tabs
  keep a fixed order, clicking the blank paper puts the caret at the nearest text
  (end below, start above), a native colour picker hides the bars and lifts the envelope or
  selected text, the toolbar mirrors the caret style, page-height dragging
  auto-scrolls at the bottom and freezes/edge-scrolls while shrinking, stale
  boot sessions expose reset/local-copy recovery, the mobile stage reserves an
  end margin for
  reaching the grip, the keyboard inset scrolls the paper while
  the shell stays fixed and the open style sheet suppresses the keyboard and
  reserves its own height below the paper, and the read page opens a larger zoom
  without changing width when its height changes.
- E2E runs in local-storage mode with a seeded fixture; there are no automated
  PocketBase/auth/realtime/email/backup tests. Migrations, protected media,
  room singleton, note locking and the email attempt fields are verified manually
  against a local PocketBase instance.
- Three older smoke tests reference sticker names/layers (“Dreamy moon”,
  “Sparkle”, heart-burst drag) that are not in the current fixture/catalog and
  fail independently of Notes; the Notes flow and the Home smoke test pass.
- CI does not run tests, typecheck, lint, or format before deploying.

## 17. Deployment

### 17.1 Containers

- Compose project `journeybook`, with two services:
  - `pb`: Alpine + PocketBase (default `0.40.5`), with committed migrations and
    hooks. `pb_data` is a named volume (`journeybook_pb_data`). Healthcheck hits
    `/api/health`.
  - `web`: Node build stage produces the SPA, then Caddy serves it and proxies
    `{APP_BASE}/api/*` and `{APP_BASE}/_/*` to `pb`. The `caddy_data` and
    `caddy_config` volumes retain certificates; ports 80 and 443 are published.
- Production images are `ghcr.io/hippolippo/journeybook-web` and
  `ghcr.io/hippolippo/journeybook-pb`, tagged with the commit SHA and `main`.
  Compose falls back to local `:local` builds when those variables are unset.
- Production runs at `https://haftels.com/journeybook/`
  (`DOMAIN=haftels.com`, `APP_BASE=/journeybook`). The root `/` is unused and
  available for other apps. A bare base path redirects to the trailing-slash
  form.
- `APP_BASE` supports serving at the root or any subpath. Hashed assets are
  immutable; `/api/files/*` requires a Protected-file token and is cached
  privately for a year; SPA HTML is `no-cache`. Vite copies `public/` (the web app
  manifest, home-screen icons, §4.6, and the app-shell service worker) into the
  image root; they are served as static files under `APP_BASE`.
- Environment variables (names only): `VITE_PB_URL`, `VITE_BASE`, `DOMAIN`,
  `APP_BASE`, `PB_IMAGE`, `WEB_IMAGE`, `IMAGE_TAG`, `PB_VERSION`, `BACKUP_KEEP`,
  `BACKUP_REMOTE`, `BACKUP_RSYNC_TARGET`, `BACKUP_STAGE_DIR`, `PB_DATA_DIR`,
  `COMPOSE_PROJECT_NAME`, plus local setup/admin credential variables documented
  in `server/README.md`.
- Note notification email is configured in the PocketBase admin UI, not through a
  compose variable: **Settings → Mail settings** and **Settings → Application
  URL** (§17.5).

### 17.2 CI/CD

- One workflow (`.github/workflows/deploy.yml`) triggers on pushes to `main` and
  manual dispatch. It runs with `packages: write` and a `deploy-production`
  concurrency group that does not cancel an in-flight deploy.
- The build job builds and pushes `journeybook-web` and `journeybook-pb` to GHCR,
  tagged with the commit SHA and `main`, using GitHub Actions cache.
- The deploy job:
  - uploads the repository over SSH to `~/journeybook` on the `deploy` user,
    excluding `.env*`, `node_modules`, builds, `pb_data`, and the PocketBase
    binary;
  - writes `docker/.env` from the repository variables;
  - logs in to GHCR with the workflow's short-lived `GITHUB_TOKEN` (no stored
    registry credential);
  - runs `scripts/deploy.sh` with `IMAGE_TAG` set to the commit SHA.
- Configuration lives in repository settings (names only):
  - variables: `DOMAIN`, `APP_BASE`, optional `BACKUP_REMOTE`,
    `BACKUP_RSYNC_TARGET`;
  - secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `PB_ADMIN_EMAIL`,
    `PB_ADMIN_PASSWORD`.
- The superuser credentials are base64-encoded into the remote script over SSH
  stdin; they never appear in a URL, argv, or process list.
- There is no test/typecheck/lint/migration-check/backup-verify job.

### 17.3 Deploy and migrations

- `scripts/deploy.sh` stops the stack, snapshots the `pb_data` volume to
  `backups/pb_data-<UTC>.tar.gz` on the host (newest 10 kept), pulls images,
  upserts the superuser, starts with `--wait`, and verifies
  `{APP_BASE}/api/health` through Caddy.
- The superuser is upserted on every deploy from `PB_ADMIN_EMAIL` /
  `PB_ADMIN_PASSWORD`, so changing the secrets and redeploying rotates the admin
  credentials.
- First deploy creates the superuser. The two app users are created manually in
  the admin UI at `{APP_BASE}/_/` with `name` and `role` (`him`/`her`); there is
  no signup.
- PocketBase applies migrations on container start, **after** the pre-deploy
  snapshot. `1700000016` adds the `notes` collection on the first deploy that
  contains notes.
- The deploy script hardcodes the volume name `journeybook_pb_data`.
- Restore is documented as a manual drill: stop, replace volume contents from a
  snapshot, redeploy; or use the PocketBase admin Backups → Restore.

### 17.4 Backups

Three layers:

1. **Every redeploy**: host tarball of `pb_data` in `~/journeybook/backups`,
   newest 10. On-box only.
2. **PocketBase scheduled**: daily 03:00 archive inside `pb_data`, 14 retained.
3. **Off-box (required once real memories exist)**: `scripts/backup-offsite.sh`
   copies archives with rclone or rsync. It is **not yet configured or
   scheduled**; set `BACKUP_REMOTE` or `BACKUP_RSYNC_TARGET` as a repository
   variable and add the host cron entry from `docs/DEPLOYMENT.md`. There is no
   encryption, checksum verification, automated restore test, or remote
   retention.

### 17.5 Notes email

- `server/pb_hooks/notes.pb.js` sends a short notification when a note becomes
  `sent` (never the letter content): the sender's name, a link to
  `{meta.appURL}/notes/{id}`, and a Journeybook footer.
- SMTP is configured in the PocketBase admin UI, not in the repository. Set
  **Settings → Mail settings** (host, port, user, password, TLS), sender address
  and name, and use the test button. The sender address and public link are
  `settings.meta.senderAddress` and `settings.meta.appURL`, never hardcoded. The
  Alpine backend image has no local `sendmail`, so SMTP is required in production.
  The sending domain must be verified with the provider and carry SPF, DKIM and
  DMARC records for trusted delivery.
- **Settings → Application URL** must be the public app URL (for example
  `https://haftels.com/journeybook`); it is used for the deep link. With no app
  URL the email contains only a relative path.
- Sending is best-effort and never blocks a letter. A failure is logged and
  `emailLastAttempt` starts a 15-minute cooldown; a cron hook retries while
  `emailedAt` is 0. There is no external queue.
- The link lands on `/notes/{id}` through the login redirect (§3). The recipient
  must be signed in.
- The hook rejects recipient attempts to change content fields on a sent letter;
  only `openedAt` (with `updatedAt`) is accepted. After opening, the author's
  content/openedAt/mail fields are frozen too; only `deletedAt` (trash) remains.
  A concurrent editor save is rejected and lands in the sync recovery lane.

## 18. Known gaps and risks

These are current facts, not desired behaviour. Fixing one requires a spec update.

**Product gaps**

- Games and Camera are not implemented.
- Notes are implemented (§22) but advanced composition — stickers, photos,
  multiple text boxes — is not. Notes are one page with one text flow.
- Notes are excluded from library/book export; there is no per-user notes export.
- Notes have no search, replies, attachments, or multi-page letters.
- Organizer lacks search, tags UI, reorder, and move-between-folders.
- No doodle/freehand tool, no caption editor, no distinct text element.
- No multi-select or true grouping in either editor.
- Published is a UI-only read-only flag; the API and store still allow edits.
- Mobile read-only is component-level only; Calendar is editable and no backend
  rule enforces the policy.

**Data and sync risks**

- Local mode has one local identity (`local`) and a placeholder partner. Notes
  compose and land in Outbox/Drafts, but the local Letters inbox stays empty; no
  partner account exists offline.
- Rich-text letters align ruled/grid papers to a 32 px paragraph grid and the
  first baseline (64 px for Wide ruled). Very large runs can exceed one line box
  and break rule alignment; mixed font sizes on a single line can shift a
  baseline slightly.
- Off-box backups are not configured yet; until they are, recovery depends on
  on-box snapshots. This needs a real remote target/credentials and is not
  something the app can complete by itself.
- Protected media URLs contain a short-lived bearer token; anyone who copies a
  live URL can use it until that token expires. File records remain auth-gated.
- Library import stores the previous room/items as a named layout and moves the
  old layouts/presets to trash, but restoring that layout still requires the user
  to apply it manually.
- The offline snapshot is written only after a successful sync and is limited by
  browser storage quota; a first-ever offline load has nothing to show. It stores
  data/notes metadata, not album photo bytes, so photos still need a connection.
- The note email link still depends on `meta.appURL`; without it the email
  contains a relative path.

**Room risks**

- Performance-light fallback only draws a bloom for items with a `bloom`
  animation. Shipped light fixtures declare explicit `lights` but no bloom, so
  performance mode may show no light for them.
- `AnimationDef.nightOnly` is not enforced for generic animations; only the legacy
  `glow` recipe is night-filtered.
- Per-variant `effect` is discarded by the loader (only per-variant animations and
  particles survive).
- A hidden host hides its children on mobile even when a child is not hidden.
- Auto day/night does not tick while the room stays open.
- No snapping, alignment, collision prevention, or whole-item on-screen clamp.

**Notes risks**

- The email deep link requires the recipient to be signed in; there is no magic
  link or signed token.
- Note draft privacy depends on the PocketBase list/view rules. A superuser or
  admin can read drafts.
- The mobile notes style sheet covers the letter while it is open; the letter is
  visible behind/above it but not interactive until Done.
- There is no unread indicator outside Home/Notes (no room-bar badge or push).
- The wax seal initial is derived from the author’s name (G in local mode) and is
  not separately editable. It uses the lighter outer-wax tint, not an independent
  colour.
- A simultaneous recipient opening and author save is resolved by the server
  lock, but the author's already-optimistic local edit is not automatically
  reconciled; the failed save sits in the sync recovery lane until retried or
  discarded.

**Scrapbook risks**

- Captions are modelled and rendered but cannot be edited.
- Legacy `photo` elements have no creation path.
- Sticker single-colour `tint` support is unused by shipped assets.
- Rendered note text is not selectable; only the textarea is.
- Album uploads are stored at full resolution (up to 25 MB); only display
  thumbnails are generated. There is no upload downscaling or storage re-encode.

**UX and platform risks**

- Home's togetherness text does not tick while open.
- Settings' Auto copy says "where you are" but uses the shared reference timezone.
- Reduced-motion coverage is partial (light pulse and some transitions remain).
- Dialog accessibility is incomplete (no focus trap, inconsistent roles/Escape).
- Icons are not consistently labelled or hidden for screen readers.
- Unknown routes render an empty shell with no 404.
- No CI gates before deploy.
- `pnpm format` reports pre-existing style issues in files outside the Notes
  work; new notes files pass Prettier. Three legacy Playwright smoke tests fail on
  stale sticker/layer names (see §16).
- `server/README.md`, `README.md`, and this document must be kept aligned (see
  §21).

## 19. Roadmap

Status is indicative, not a commitment.

1. ~~Foundation: scaffold, auth, PocketBase schema, scrapbook tree.~~ Done.
2. ~~Square pages with freeform elements.~~ Done.
3. ~~Room rendered from `room`/`room_items`, then a desktop editor.~~ Done.
4. ~~Calendar, settings, trash, backups, mobile read-only.~~ Done.
5. ~~Notes feature.~~ Done (§22). Games, then Camera next.
6. Advanced notes: stickers, photos, and multiple text boxes; optional replies and
   a per-user notes export.
7. Organizer search/tags/reorder.
8. Doodles/freehand, captions, true grouping.
9. Continue with the remaining §18 gaps; data-safety/correctness items are implemented.

## 20. Open questions

- Should notes be exportable per user (and in what format), given that they are
  excluded from the shared library export?
- Should advanced notes reuse the scrapbook page editor (freeform layers) or
  stay a separate rich-text model with a block/box extension?
- Which SMTP provider will send the note notification in production, and should
  the app show an in-app unread indicator outside Home/Notes?
- Should published books become genuinely public/shareable, or is the flag only a
  personal "finished" marker? If public, what is the access model?
- Should the two users be allowed different permissions (owner-only editor), or
  stay fully shared?
- Should day/night follow each viewer's local time or one shared reference
  timezone? The users are in different zones.
- Should the calendar become timezone-aware (per-event zones, recurrence in the
  event's zone, DST handling)?
- Should organizing gain search/tags/reorder, and do tags become the cross-tree
  mechanism?
- Should user-supplied art enter the catalog at runtime, and how is it stored and
  validated?
- What is the desired conflict model if both users edit the same room or page at
  once?
- Which off-box backup destination is final (rclone remote vs rsync host)?

## 21. Specification maintenance (non-negotiable)

- `SPEC.md` is the single source of truth for behaviour.
- Every change that alters behaviour, UI, routes, data shape, persistence, asset
  contracts, deployment, or tooling **must update this file in the same branch**,
  normally in the same commit.
- Required on every spec-affecting change:
  1. Update the affected section(s).
  2. Update **Last updated**.
  3. Append a row to the **Spec change log**.
  4. Update §18 when a known gap is fixed or discovered.
- If a change genuinely needs no spec update, the agent must say so explicitly in
  the commit message or final report, with a one-line reason.
- Do not document unimplemented behaviour as shipped. Put intent in §19, and
  current limitations in §18.
- When code and spec disagree, treat it as a defect. Fix both in the same change
  or record the discrepancy in §18 immediately.
- Keep the TypeScript snippets aligned with `src/data/types.ts` and
  `src/catalog/types.ts`.
- `design/` is visual reference only. It is never authoritative for behaviour.

---

## 22. Notes (letters)

Notes are a private letter exchange between the two users. A note is **one page
with one rich-text flow**, separate from the plain-text notes that sit on
scrapbook pages (§8.5). It is not a second scrapbook page editor.

### 22.1 Model and privacy

- A `Note` carries the author, recipient, status (`draft`/`sent`), rich-text
  body, paper and tint, a fixed-width/author-set page height, an envelope
  configuration, and timestamps (`createdAt`, `updatedAt`, `sentAt`, `openedAt`,
  `emailedAt`, `deletedAt`). The types are in §12.
- Drafts are visible only to their author. Sent letters are shared by the author
  and recipient for reading. PocketBase enforces this on list/view (§13).
- The recipient is the other account in the shared space. The author is the
  signed-in user. In local mode the single local identity is `local`; its
  placeholder partner has no inbox.
- Sent letters are editable and unsendable by the author until the recipient
  opens them. Opening locks author edits in the UI; see §18 for the backend
  limitation.
- The recipient may only record `openedAt` (with `updatedAt`); the notes hook
  rejects content rewrites from the recipient.

### 22.2 Lists and navigation

- `/notes` has three lists: **Letters** (received, unread count on the tab),
  **Outbox** (sent), and **Drafts** (private). `?tab=outbox`/`?tab=drafts` selects
  a list; the composer navigates back to the matching tab.
- A received unopened letter shows no preview (“A sealed letter. Break the seal
  to read it.”); an opened one shows a two-line preview. Outbox cards show
  Sealed/Opened. Draft cards show the note paper and its first line, followed by
  an edited timestamp. The selected Drafts tab already identifies the list, so
  draft cards do not repeat “Draft” in a title, chip, preview, or timestamp.
- Counts are per-list; there is no search, sort control, reply action, or
  per-letter notification list.
- The Home layout has a Notes cover (§6). It opens `/notes` and shows a mustard
  “N unread” badge only while the inbox has unread letters.

### 22.3 Composer and rich text

- `/notes/new` creates a draft immediately and replaces the URL with
  `/notes/:noteId/edit`, so a refresh keeps the same draft.
- The letter is a fixed **480 logical-px-wide** page with an author-set height of
  380–1100 px in 10 px steps (default 620). The height is set only by dragging the
  paper’s bottom grip; there is no slider, no Page section in the composer panel,
  and no height readout. The page’s visual width is set only by the available
  stage width (capped at the 480 logical px page), never by its height; compose and
  read use the same horizontal gutter on phones, and tall pages scroll vertically.
  Resizing captures the pointer and suppresses native touch scrolling. The stage
  stays fixed while the pointer is away from its edges. Within the 96 px bottom
  edge zone it auto-scrolls down with a proximity ramp while the page grows; when
  shrinking, it stays fixed until the pointer enters the 96 px top edge zone, then
  auto-scrolls up so the drag can continue. While shrinking, the stage temporarily
  adds bottom space equal to the removed page height so its scroll range does not
  collapse and the grip can follow the finger; the spacer is removed on release.
  Both directions stop at the 1100 px limit. The visible grip is small but has a
  larger 44 px touch target. On phones the stage also keeps an 88 px end margin
  below the page, so a taller page can be scrolled clear and the grip reached to
  shrink it again.
  The composer and reader use the full shell height instead of reserving the
  bottom safe area, so the paper and its red overflow can extend down over the
  room floor. The send confirmation still reports fit or overflow.
- The page sits on one of the seven asset-defined note papers (the transparent
  `none` option is not offered in Notes). The picker uses labeled four-column
  preview cards; the selected card has a terracotta outline and check. Preview
  backgrounds use a quarter-scale rule/texture rhythm so several repeats are
  visible (Kraft’s grain included). Every paper exposes its tint palette plus a
  free colour picker; Sticky note carries rose, sage, sky and other tints in one
  entry.
  Ruled/grid/dot papers share the paragraph line grid: a 32 px rhythm (64 px for
  Wide ruled), with the first text baseline on the first writing rule and a blank
  rule above it. Paragraph margins are zero so every line stays on that grid.
  Horizontal and vertical rule tiles are each exactly one rhythm high/wide, so
  neither paper edge nor the top of the page paints a split or doubled rule.
  Very large runs can overflow a single 32 px line box and sit differently relative
  to the rules.
- Text is stored as a versioned `RichDoc` of blocks and runs (sanitised on every
  serialise). Supported formatting:
  - fonts: the ten scrapbook pens plus Print (Nunito) and Serif (Fraunces);
  - size: 10–48 offered in the toolbar (model clamps 8–96 px);
  - ink: the eight-note palette or any colour; highlight: five presets, any
    colour, or clear;
  - bold, italic, underline, strikethrough;
  - per-paragraph left, centre, or right alignment.
- Font, size, ink, highlight and the bold/italic/underline/strikethrough toggles
  apply to a selection, or at a collapsed caret they set the typing style for the
  text entered next. A collapsed caret can therefore set the next text's font,
  size, colour, highlight and decorations without selecting words; later controls
  compose with the pending typing style. Alignment applies to the current
  paragraph. Invisible typing markers are stripped from the stored document.
- The Writing controls mirror the format at the current selection or caret:
  font and size selects, active ink/highlight presets, the centre colour of both
  custom pickers, bold/italic/underline/strikethrough, and alignment. The custom
  highlight centre is transparent when no highlight is active. Moving the caret
  updates every control.
- Clicking anywhere on the paper outside the text moves the caret to the nearest
  text position: above the first line it goes to the start of the letter, below
  the last line it goes to the end, and within the text it goes to the nearest
  line and character. Clicking directly in the text keeps native selection.
- Pasting inserts plain text only. The sanitizer drops scripts, media, links,
  event handlers, unknown fonts, unsafe colours, and out-of-range sizes.
- Text that runs past the page continues below the paper in red. The send
  confirmation repeats the overflow (“Runs about N lines past the page”) and the
  paper grip is the only height control. The edge is not auto-fitted; the author
  lengthens the page or trims the text.
- Drafts autosave about 450 ms after the last edit. Desktop shows **Save draft**,
  which flushes and opens Drafts; on phones the action is hidden and closing the
  composer flushes and keeps the draft. **Save changes** on a sent-before-opened
  letter flushes and returns to Outbox. In-app navigation flushes; closing the
  browser tab while the 450 ms autosave is still pending triggers the standard
  unsaved-changes warning.
- Phones can compose. The stage keeps the letter visible and the style controls
  are a fixed bottom sheet with a Done action. The paper/pen and envelope
  sections remain available in the sheet. The composer bar is one non-wrapping
  row at iPhone widths (375–430 px): icon back, recipient with the full sent/draft
  status underneath, icon-only Style button, compact Letter/Envelope switch, and
  Send/Save. The Style button sits left of the mode switch so hiding it in Envelope
  mode does not move the switch. The desktop bar keeps the full text labels; on phones
  “Seal & send” becomes **Send**, “Save changes” becomes **Save**, and the
  **All notes** and **Style** labels become accessible icon buttons.
- With the Paper & Pen sheet open, the composer stage gets extra bottom space
  equal to the sheet height, so the paper can scroll completely above the sheet
  and its bottom edge remains visible. The sheet and room background stay fixed;
  only the page stage scrolls.
- While a native colour picker is open on a phone, the room bar and composer bar
  are hidden, the envelope is pinned to the open top area, and the panel’s reserved
  space is removed. In the letter editor the selected text/line is scrolled to
  the top. Selecting a colour does not restore the layout; it stays lifted until
  the native picker is dismissed (the colour input blurs), then the normal bars
  and layout return.
- On desktop the Paper & pen settings sidebar is content-sized: it ends after its
  Paper/Writing content rather than stretching to the stage bottom, and caps at
  the stage height with internal scrolling if needed. On phones the same controls
  are a fixed bottom sheet with **Paper** and **Pen** tabs; the tabs and **Done**
  share one compact header row (no sheet title or grip), and the sheet is only as
  tall as the taller of the Paper/Pen contents, capped at 52dvh. Both panes stay
  laid out with the inactive one hidden, so switching tabs never resizes the sheet.
  It remembers the last tab.
  In Envelope mode on phones the controls are always open: there is no Style
  toggle, sheet header, Done button, or Paper/Pen tabs. The envelope stays visible
  above the compact Envelope/Wax seal/Stamp panel, which is reserved out of the
  stage; the envelope caption, section hints and stamp-reuse hint are omitted.
  The Stamp heading and custom Stamp/Postmark pickers share one row.
- On phones, opening the sheet blurs the editor and turns off the soft keyboard
  without making the letter read-only: text can still be selected and restyled.
  Closing the sheet restores the normal editor keyboard policy. The sheet and the
  room shell stay put when the keyboard appears; the composer stage grows its
  bottom padding by the keyboard inset and scrolls the paper so the caret stays
  visible.
- The composer’s Letter/Envelope switch shows a live front-of-envelope preview
  when Envelope is selected.

### 22.4 Envelope, seal and stamp

- The envelope is CSS-drawn on one of eight paper-tint presets or any custom
  colour. A continuous outline sits above the body and flap, so the border encloses
  the full envelope rectangle; the clipped triangular flap is separate only for
  the flip/slide opening animation. There is no liner customisation.
- The wax seal reuses the shipped `wax-seal-stamp` sticker art and its recolour
  palette or any custom colour, and carries the author’s first initial. It is
  deliberately prominent (about a fifth of the envelope width, capped at 76 px
  and 96 px in the large/read view). The initial uses the lighter outer-wax tint
  with an embossed shadow; in local mode it is **G**. In PocketBase mode it is the
  author’s name initial (fallback G).
  The stamp reuses the shipped `postage-stamp` sticker art with five preset
  colourways plus independent custom **Stamp** and **Postmark** colours. The
  address is drawn as “To {recipient} / from {author}”; no address editor.
- The initial is derived, not separately editable. There is no uploadable
  envelope or sticker decoration; the envelope front, seal and stamp are the only
  customisation.

### 22.5 Sending, opening and locking

- **Seal & send** opens a confirmation with the recipient, a fit/overflow
  warning, and a reminder that the author can still edit or pull it back until
  the recipient opens it.
- Sending sets `status = sent`, `sentAt`, resets `openedAt` and `emailedAt`, and
  writes through the outbox. The letter appears in the author’s Outbox and the
  recipient’s Letters.
- A sent letter is editable (`Edit`) and unsendable (`Pull back`) while
  `openedAt` is 0. Pull back returns it to Drafts and resets `sentAt`, `openedAt`
  and `emailedAt`.
- The author sees their own letter immediately when they open it. The recipient
  sees a sealed envelope first; **Break the seal** animates the flap, drops the
  seal, slides the envelope down, and fades the stationary letter in. The stage
  reserves the same geometry as the final reader so the letter does not jump.
  After the animation the recipient records `openedAt` with a targeted update.
- Once opened, the read view is locked: there is no Edit/Pull back for the
  author (Trash remains). The recipient has no destructive action. The
  PocketBase note-update guard enforces the same lock, so an offline/stale
  editor cannot overwrite an opened letter; its queued save becomes an unsynced
  change for retry or discard.
- The opened letter can be enlarged by double-clicking or double-tapping the
  paper. The read-only zoom overlay uses nearly full width on phones and up to
  760 px on desktop, scrolls vertically when the page is taller than the screen,
  and closes with its Close button or Escape.
- Notes can be moved to the trash by the author; recipients cannot. A trashed
  note is soft-deleted and can be restored from Settings’ trash. The daily purge
  eventually removes it.

### 22.6 Persistence, sync and email

- Local mode stores notes under `journeybook:notes:v1` and quarantines unreadable
  payloads under `journeybook:notes:v1.corrupt:<timestamp>`. There is one local
  identity; drafts/outbox work, but the Letters inbox is empty.
- PocketBase stores notes in the `notes` collection (§13). Writes use the
  persistent outbox; opens use a targeted `openedAt` update. The notes store
  subscribes to `notes`, skips refreshes while composing or while writes are
  queued, and catches up when the composer closes.
- Notes are **not** in `AppData` and are excluded from whole-library and book
  export/import (§14.4). The PocketBase backup includes them.
- On `sent`, `notes.pb.js` sends a short notification email through PocketBase’s
  mail settings: sender name, a link to `{meta.appURL}/notes/{id}`, and no letter
  content. Sending is best-effort; a 15-minute cron retries while `emailedAt` is
  0, with `emailLastAttempt` preventing rapid repeats. The recipient must sign in;
  the login redirect returns them to the letter. See §17.5.
- When the API is unreachable, the notes list uses the current account’s last
  successful snapshot; logging out clears it. The app-wide offline pill marks the
  cached state.

### 22.7 Home

- Notes appears beside Scrapbooks as a matching cover: sage, the same spine,
  tape, cream label plate and dimensions; a lined-paper sheet replaces the
  scrapbook’s pressed flower. The flower and the sheet share the right-edge
  anchor; the sheet is smaller, sits above the card floor, and its folded corner
  is cut out so the cover shows through the notch. There is no floating letter on
  the cover. On phones the two covers stack vertically in a compact layout
  (roughly 240–280 px wide and 100 px tall at iPhone widths); the shelf layout shrinks to
  fit them so the decorated wall remains visible around all four sides. Labels
  and props scale down but stay readable and clear of each other.
- The only badge is the unread count; it disappears at zero.

### 22.8 Limits

Advanced composition (stickers, photos, multiple text boxes), replies,
attachments, multi-page letters, notes search, per-user notes export, and an
in-app unread indicator outside Home/Notes are not implemented. See §18–§19.

## Appendix A — Spec refresh audit (commits since `7973394`)

| Commit(s)                       | Change                                                          | Covered in                               |
| ------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `0f2a452`                       | Design mockups and visual spec                                  | §15; merged and removed `design/SPEC.md` |
| `b897ba5`                       | Initial app: room, scrapbooks, square pages, editor             | §6–§9                                    |
| `f232994`                       | PocketBase schema, two-user auth, realtime                      | §3, §4.4, §13                            |
| `2bce461`, `e79cb15`            | Ignore PocketBase artifacts / Windows gitignore                 | No behaviour change                      |
| `fb46ce2`                       | Page editor, media album, room editor upgrades                  | §8.3–§8.7, §9.9                          |
| `633c21c`                       | Togetherness countdown and shared calendar                      | §10                                      |
| `5714bd9`                       | Docker Compose deployment                                       | §17                                      |
| `26aac17`                       | Effects engine, stickers/frames/papers, attachment, depth       | §8.6, §9.2–§9.8                          |
| `e309499`                       | Room-decor JSON skill                                           | §9.2                                     |
| `874ab9e`, `d8c70cb`            | Sidecar catalog refactor and art variants                       | §9.2                                     |
| `d4f5b1c`, `79871ea`, `78d50d5` | Editor parity, attachment transforms, recolour, window variants | §9.3–§9.9                                |
| `c3ffed7`                       | Editor polish and data-driven lighting                          | §9.6–§9.7                                |
| `4438c2e`, `4daacf9`            | Mobile read-only layout, settings, inline icons                 | §5.3, §11, §15.3                         |
| `8150f67`                       | Durable writes, backups, trash                                  | §14, §17.4                               |
| `ba879a7`                       | Empty-by-default library, asset-driven decor                    | §9.11, §14.1                             |
| `874e0ec`, `3014484`            | Recolourable sticker set and palette fixes                      | §8.6                                     |
| `2d89d5e`                       | Solid floors, item shadows, rug hosting, sticker flip           | §8.6, §9.3, §9.8                         |
| `63a71cc`, `553ac77`            | Subpath support, CI/CD, backup-on-redeploy, bare-base redirect  | §17                                      |
| `b43d2be`                       | Pressed daisy on the Home hero                                  | §6                                       |
| `0c5d93e`                       | Note vertical centring and text selection                       | §8.5                                     |
| `83e2cce`                       | Room art refresh                                                | §15.2                                    |
| `3bc8926`                       | Contact-shadow levelling, window hitbox, curtain anchor         | §9.3, §9.8                               |
| `edfcfff`                       | PocketBase thumbnails and media caching                         | §8.4, §17.1                              |

Merge commits (`794e2e5`, `fe4ed3a`, `b248ed3`, `f12e638`, `157dab8`, `0c233da`,
`fdabeca`, `c0abbd5`, `493cf2d`) introduced no independent behaviour beyond their
constituent commits.
