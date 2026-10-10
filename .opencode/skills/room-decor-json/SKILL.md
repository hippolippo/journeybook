---
name: Room Decor JSON
description: Create the sidecar JSON definition for a Journeybook room decoration from its SVG art (single day art or day/night variants), including placement, color slots, and optional motion. Use when adding a new room item's `.json` next to its `.svg`, or when asked to describe/register room art.
---

# Room Decor JSON

Turn room-decoration SVG art into the matching sidecar JSON
(`src/assets/svg/<name>.json`) that `src/catalog/loadDecor.ts` loads. Full field
semantics live in `docs/ASSET_GUIDE.md` (§4–§9); this skill is the repeatable
procedure plus a zero-dependency helper CLI.

The helper CLI (plain Node, no install needed) does the mechanical work:

```
node .opencode/skills/room-decor-json/scripts/room-decor.mjs inspect  <svg> [--night <svg>] [--json]
node .opencode/skills/room-decor-json/scripts/room-decor.mjs scaffold --svg <svg> [options]
node .opencode/skills/room-decor-json/scripts/room-decor.mjs check    <json> [--svg-dir <dir>]
```

## Non-negotiables

- **Only add motion the user asked for.** Never emit `effect`, `animations`, or
  `particles` unless the user explicitly requests an animation/particle (and
  only on the day/night variant they name). Silence means static art.
- **Ask before assuming placement.** Never guess whether the item is furniture,
  a shelf/host, or a surface item that attaches. Ask the user.
- **Every recolorable part gets a slot.** If the SVG uses `var(--c-<id>, …)`,
  the definition must declare that slot with a matching `default`, a `palette`,
  and `allowCustom`. Add `presets` when there are two or more slots.
- **Stay in `src/assets/svg/`**, one asset per file, kebab-case (AGENTS.md §9).
- Do not invent fields. `check` rejects anything the loader won't understand.

## Workflow

### 1. Confirm the art

Identify the base name and whether a night variant exists:

- `src/assets/svg/<name>.svg` — day art (required).
- `src/assets/svg/<name>-night.svg` — optional night art.

If the user gave only a description, ask which SVG(s) to use. Do not create or
edit the art itself.

### 2. Inspect

```
node .opencode/skills/room-decor-json/scripts/room-decor.mjs inspect src/assets/svg/<name>.svg [--night src/assets/svg/<name>-night.svg] --json
```

Read the reported `aspect`, `viewBox`, and `slots` (each slot's `id`, `default`
fallback, and which variants use it). If the SVG has no `viewBox`, stop and ask
the user to add one (fixed `width`/`height` don't scale cleanly).

### 3. Ask the placement questions

Use the `question` tool. Work through these until every answer is explicit:

1. **What kind of thing is it?** → `category`:
   `wallpaper` | `flooring` | `furniture` | `wallDecor` | `trinket` | `pet`.
2. **Is it furniture, a shelf, or something that rests on other things?**
   - **Furniture** (floor) or **wall decor / shelf** (wall) → `layer` `floor`/`wall`.
   - **Rests/attaches on something** (trinket, pet) → `layer: "surface"` and set
     `attach`: `furniture`/`any` (any resting surface) or `shelf` (wall hosts only).
3. **Can it hold other items?** If it is a desk/shelf/etc. that should host
   surface items, set `"host": true` (wall/floor items only — never a surface item).
4. **Does it tile?** String lights / bunting / borders → `repeat`: `x` | `y` | `both`.
5. **Motion?** Ask explicitly: any **animation** (sway, bob, twinkle, glow…),
   any **particles** (smoke, fireflies, zzz…), and whether any of it is
   **night-only**. Only record what they ask for. For night-only effects use the
   per-variant form (`art.night: { src, particles|animations }`).

See `references/room-fields.md` for the placement matrix and ready-made motion
fragments.

### 4. Scaffold

```
node .opencode/skills/room-decor-json/scripts/room-decor.mjs scaffold \
  --svg src/assets/svg/<name>.svg \
  [--night src/assets/svg/<name>-night.svg] \
  --category <c> --layer <l> --band <b> [--attach <a>] [--host] \
  [--repeat <r>] [--label "…"] [--scale <n>] \
  [--motion <fragment.json>] [--night-motion <fragment.json>] \
  --out src/assets/svg/<name>.json
```

This derives `id`, `label`, `aspect`, `defaultScale`, and the `colorSlots`
(with the shared palette) automatically, and adds `presets` when there are 2+
slots. It emits **no motion** unless you pass `--motion`/`--night-motion`.

### 5. Refine

Edit the JSON for anything the scaffold can't infer: nicer `label`s, more
relevant `palette` colors, hand-tuned `presets`, and any motion the user asked
for. Use the templates in `references/room-fields.md` and the palette scheme
names in `references/palettes.md`.

### 6. Check

```
node .opencode/skills/room-decor-json/scripts/room-decor.mjs check src/assets/svg/<name>.json
```

Fix every `✖` error and judge each `⚠` warning. `check` verifies enums, that
`aspect` matches the `viewBox`, that every declared slot actually appears as
`var(--c-<id>, …)` in the art, that `default` matches the SVG fallback, that
presets reference real slots, and that any motion is well-formed.

### 7. Verify in the app

Run `pnpm test` and, if the change should be seen live, open the room editor
(`pnpm dev`) and confirm the item appears in its category with the right
recolor controls, presets, day/night variant, and motion (only if requested).

## Supporting files

- `references/room-fields.md` — placement matrix, all room fields, motion templates.
- `references/palettes.md` — shared palette and named preset schemes.
- `scripts/room-decor.mjs` — the `inspect` / `scaffold` / `check` CLI.
- `fixtures/` — sample art the test suite exercises the CLI against.
