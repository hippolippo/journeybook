# Journeybook — Model Constitution

This file is the highest authority for how an AI agent operates in this
repository. When anything here conflicts with a general default or with the
wording of a request, this file wins. When a request conflicts with this file,
stop and confirm with the user before proceeding.

For any question or research task about the app, **`SPEC.md` is the first stop**.
Read it before searching code or history; see §3 for the required research order.

## 1. Mission

Journeybook is a private, long-distance memory-keeping app for exactly two
users: the owner and their girlfriend. It is not a product with a market — it is
a shared scrapbook, made to feel personal, warm, and safe.

Core use cases:

- Scrapbooking: store and arrange images, pages, and written memories.
- Notes: shared written entries.
- Games: small real-time multiplayer games between the two users.
- Camera: real-time camera features (capture, share, together-in-the-moment).

Success is measured by how delightful and reliable it feels for two people, not
by scale. Optimize for low cost, low maintenance, and data safety.

## 2. The Mission Protocol (non-negotiable)

Before implementing anything, be crystal clear on the mission:

1. Restate the goal in your own words and confirm it matches the user's intent.
2. Start research in `SPEC.md` — always the first stop, before searching code,
   reading components, or checking history. Read the affected sections and
   identify any code/spec mismatch.
3. Identify unknowns and ambiguities. Resolve every one by asking the user —
   do not proceed while you have doubts.
4. Produce a concrete plan (files, approach, tradeoffs, spec updates,
   verification).
5. Get explicit approval of the plan.
6. Only then act. Once the plan is approved and unambiguous, act freely and make
   reasonable in-scope decisions without re-asking for every small step.

Planning before acting is mandatory. Freely improvising before the plan is clear
is a failure, even if the code works.

## 3. Specification Discipline (non-negotiable)

`SPEC.md` is the single source of truth for what the app does. The code and the
spec must never disagree. This section is a gate, not a suggestion.

### Research order

`SPEC.md` is the **first stop for every research task**, not only for
implementation work. Use this order:

1. **`SPEC.md`** — read the relevant sections first. It defines intended
   behaviour, data shapes, asset contracts, and known gaps.
2. **Code** — use the spec to decide which files to inspect, then verify the
   implementation detail.
3. **Tests and history** — use them to confirm edge cases or when the spec is
   silent.

Do not begin with repository-wide grep, file crawling, or `git log`. If the spec
does not answer the question, say so, inspect the code, and record the gap in
§18 when it is a real discrepancy. Never treat code as the definition if it
contradicts the spec.

### Before implementing

1. Read the affected sections of `SPEC.md` before planning. If the requested
   behaviour is not described there, say so and propose the spec change first.
2. Treat a code/spec mismatch as a defect. Do not silently implement around it.
3. If the request changes behaviour, the plan must include the exact `SPEC.md`
   sections that will change.

### During implementation

Every change that alters any of the following **must update `SPEC.md` in the same
branch**, normally in the same commit:

- user-visible behaviour, layout, copy, or navigation;
- routes, screens, or mobile/desktop policy;
- data shapes, collections, fields, migration behaviour, or sync semantics;
- room/catalog/asset contracts (sidecar fields, colours, hosts, lighting,
  effects, animations, particles);
- scrapbook elements, frames, papers, notes, stickers, tape, or media handling;
- editor capabilities, shortcuts, limits, or defaults;
- deployment, backups, CI, or environment requirements;
- tooling that the spec references (scripts, commands, test coverage).

Required edits on a spec-affecting change:

1. Update every affected section.
2. Update the **Last updated** date at the top of `SPEC.md`.
3. Append a row to the **Spec change log**.
4. Update **§18 Known gaps and risks** when a gap is fixed, introduced, or
   discovered.
5. Keep TypeScript snippets aligned with `src/data/types.ts` and
   `src/catalog/types.ts`.

### After implementing

- Include `SPEC.md` in the final verification: confirm the diff is intentional and
  describes the shipped behaviour.
- If a change genuinely needs no spec update, state that explicitly in the final
  report or commit message, with a one-line reason. Silence is not acceptable.
- Never document planned or unverified behaviour as shipped. Put intent in
  **§19 Roadmap** and limitations in **§18 Known gaps and risks**.
- `design/` holds visual mockups only. `design/SPEC.md` no longer exists; its
  content was merged into `SPEC.md`. Never treat `design/` as behavioural
  authority.

## 4. Communication

- Plan before acting. Lead with the plan, then execute.
- Be concise and direct. No filler, no flattery, no unnecessary preamble or
  postamble.
- State assumptions out loud; flag risks and tradeoffs when they matter.
- If a request is ambiguous or would violate this constitution, ask instead of
  guessing.
- Reference code locations as `file_path:line_number`.

## 5. Autonomy

- Act freely within the approved scope. Make reasonable decisions for small
  details without asking.
- Stop and confirm for anything risky or irreversible: schema/data migrations,
  destructive commands, dependency additions, deployment changes, or touching
  anything outside this repository.
- Never expand scope on your own. If you discover adjacent work, note it and ask.

## 6. Hard Rules (non-negotiable)

- Never commit, print, or log secrets, API keys, tokens, or `.env` values.
  `.env*` stays gitignored; commit an `.env.example` with placeholders instead.
- Do not add a new dependency without explicit user approval.
- Do not run destructive git operations (`push --force`, `reset --hard`, history
  rewrites) or destructive file operations without explicit confirmation.
- Stay in repo scope. Do not read or modify files outside this repository
  without asking.
- All new changes go on a dedicated branch. Never commit directly to `main`
  unless the user explicitly instructs it.
- Never commit or push unless the user explicitly asks.

## 7. Verification (required)

A task is not done until all of these pass:

- Typecheck: `pnpm typecheck` (`vue-tsc`)
- Lint: `pnpm lint` (ESLint)
- Format check: `pnpm format` (Prettier)
- Tests: `pnpm test` (Vitest) and `pnpm test:e2e` (Playwright) when a flow is
  affected
- Spec: the `SPEC.md` diff matches the shipped change (§3)

Rules:

- Add or update tests for new behavior. Unit/component tests with Vitest + Vue
  Test Utils; critical user flows with Playwright.
- Never claim something works without running the relevant checks. If a check
  can't be run, say so and why.
- If a verification command does not yet exist, propose adding it to
  `package.json` and record it here.
- CI does not run these checks before deploying. Contributors must run them
  locally; do not assume a green deploy means green tests.

## 8. Architecture

- Frontend: Vue 3 Single Page Application, TypeScript, `<script setup>`
  Composition API, Pinia for state, Vue Router.
- Backend: PocketBase, self-hosted on a small VPS (provider TBD), fronted by
  Caddy for TLS. PocketBase provides the database (SQLite), file storage,
  auth, and realtime subscriptions.
- Realtime (games, camera) uses PocketBase realtime subscriptions; use WebRTC
  where peer-to-peer streaming is the right fit.
- Keep it cheap: single small VPS, no managed services that add recurring cost
  without need.

### Data safety

- Content is precious and personal. Treat data loss as the worst possible
  failure.
- Automated off-box backups of `pb_data` (database + uploads) are required once
  the app is deployed and holds real memories. Backups are not required during
  local development.
- Once deployed, backups must run before any data-model or migration change.
- Schema changes are additive by default; destructive migrations require
  explicit user approval and a verified backup first.

## 9. Code Conventions

- TypeScript everywhere, strict mode. No `any` (use `unknown` + narrowing).
- Vue components: `<script setup lang="ts">`, Composition API, typed props and
  emits, small focused components.
- State in Pinia stores; keep components free of business logic where practical.
- Prefer small, pure, testable functions. Prefer standard-library and existing
  utilities over new ones.
- Follow existing patterns and naming in the repo. Mimic the surrounding style.
- Do not add comments unless they explain non-obvious intent. No decorative or
  redundant comments.
- Formatting and lint are enforced by ESLint + Prettier; do not hand-format
  around them.

## 10. Art & Visual Assets

- All art lives in a dedicated SVG assets folder — never scattered around the
  repo. One folder per area:
  - App: `src/assets/svg/`
  - Design mockups: `design/assets/svg/`
- One asset per file, named descriptively in kebab-case
  (e.g. `washi-tape-rose.svg`, `pressed-flower.svg`).
- Art generated by the LLM must first be committed as its own SVG file in that
  folder; it may then be baked into the frontend (imported or inlined) for
  rendering.
- Art provided by the user is source of truth: store it in the same folder and
  do not overwrite, recolor, or "clean it up" without asking.
- Keep SVGs accessible: decorative art gets `aria-hidden="true"`; meaningful art
  gets `role="img"` plus a `<title>`.

## 11. Tooling

- Package manager: pnpm.
- Build/dev: Vite.
- Lint/format: ESLint + Prettier.
- Types: vue-tsc.
- Tests: Vitest + Vue Test Utils; Playwright for e2e.

## 12. Branching & Commits

- One branch per change, named `type/short-description`
  (e.g. `feat/scrapbook-pages`, `fix/camera-reconnect`).
- Only commit when the user explicitly asks. When asked, keep commits focused
  and write clear messages that describe intent.

## 13. Open Questions

- VPS provider and PocketBase deployment specifics (decide when we get there).
- Auth model for the two users (invite-only accounts vs. shared space).
- Backend API surface vs. using PocketBase client SDK directly.
