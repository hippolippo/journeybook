# Journeybook — Asset & Decoration Guide

This guide is for designers/artists adding **new art** to Journeybook: room decor,
scrapbook stickers, tape, and icons — including **effects** (things that sway,
glow, or smoke), optional **day/night variants**, and **recolorable** parts with
suggested **color presets**.

You do **not** need to edit application code. You add SVG files (and, optionally,
a small JSON definition next to them) and they appear in the app automatically.

> All art lives as one-file-per-asset in `src/assets/svg/` (see `AGENTS.md` §9).

---

## 1. How the loader works

On build/dev, Journeybook scans `src/assets/svg/`:

- Every `*.svg` is available as art.
- A `*.json` **sidecar** file (same base name, e.g. `paper-lantern.json`) registers
  that SVG as a piece of decor, OR
- an SVG can embed its own definition inside a `<metadata>` block.

If an SVG has **neither** a sidecar JSON nor embedded metadata, it is ignored by
the decor system (so UI icons and one-off art are unaffected).

The **id** defaults to the file base name (`paper-lantern.svg` → `paper-lantern`),
and the **day art** defaults to `<id>.svg`.

**Examples shipped with the app** (use these as templates):

| File | Shows |
| --- | --- |
| `src/assets/svg/trailing-plant.{svg,json}` | sway effect, 2 color slots, color presets |
| `src/assets/svg/paper-lantern.{svg,json}` + `paper-lantern-night.svg` | day/night variants, night glow + flicker, presets |
| `src/assets/svg/chai-cup.svg` | **embedded** metadata, smoke effect |
| `src/assets/svg/fairy-lights.{svg,json}` | **repeating** texture across the wall, recolour presets |

---

## 2. Quick start (a new room decoration)

1. Draw your art and save it as `src/assets/svg/<name>.svg`.
2. Create `src/assets/svg/<name>.json` describing it:

```json
{
  "kind": "room",
  "label": "Woven basket",
  "category": "trinket",
  "layer": "surface",
  "band": "floor",
  "aspect": 1.1,
  "defaultScale": 0.18,
  "attach": "furniture",
  "colorSlots": [
    {
      "id": "body",
      "label": "Weave",
      "default": "#d3b184",
      "palette": ["#d3b184", "#c97b5a", "#9caf88", "#9dbfc9"],
      "allowCustom": true
    }
  ]
}
```

3. In your SVG, paint the recolorable part with the slot's CSS variable (falling
   back to a default), e.g. `fill="var(--c-body, #d3b184)"`.
4. Run `pnpm dev`, open the room editor — your item appears in its category, and
   the recolor controls appear when selected.

That's it. No code changes.

---

## 3. Asset kinds

Set `"kind"` in the definition (default `"room"`):

- `"room"` — furniture / wall decor / trinkets / pets placed in the shared room.
- `"sticker"` — a decoration placed on a scrapbook page.
- `"tape"` — a washi/masking strip placed on a scrapbook page.

### 3.1 Room decor fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Defaults to the file name. |
| `label` | string | Shown in the editor palette. |
| `category` | `wallpaper` \| `flooring` \| `furniture` \| `wallDecor` \| `trinket` \| `pet` | Palette group. |
| `layer` | `wall` \| `floor` \| `surface` | Where it sits (stacking layer). |
| `band` | `wall` \| `floor` | Which band its position is measured in. |
| `aspect` | number | width ÷ height (from your `viewBox`). |
| `defaultScale` | number | Size relative to the band height (≈ `1` fills the band). |
| `defaultRotation` | number | Degrees. |
| `attach` | `furniture` \| `shelf` \| `any` | For `surface` items (things that rest on furniture/shelves). |
| `effect` | object \| array \| null | See §6 (can combine, e.g. glow + flicker). |
| `colorSlots` | array | See §5. |
| `presets` | array | See §5.3. |
| `art` | `{ day, night }` | See §4. |
| `raw` | boolean | Force inlining the SVG (needed for recolor). Auto-on when `colorSlots` exist. |

### 3.2 Stickers

```json
{
  "kind": "sticker",
  "label": "Tiny moon",
  "tint": true,
  "defaultColor": "#d9a94e",
  "aspect": 1
}
```

- `tint: true` renders the SVG as a **mask** filled with a single chosen colour
  (best for simple silhouettes). `tint: false` (default) renders the SVG as-is
  (multicolour art, not recolourable).
- If `art.day` is omitted it defaults to `<id>.svg`.

### 3.3 Tape

```json
{
  "kind": "tape",
  "label": "Gingham tape",
  "aspect": 3.4,
  "defaultColor": "#cfe3c5",
  "opacity": 0.9
}
```

The SVG is used as a **mask** filled with the chosen colour — design it as a
solid strip silhouette (the alpha channel matters; the ink colour is ignored).

---

## 4. Day & night variants (optional)

The room has a shared day/night state. Any room item can provide a night image:

- **Auto-detect:** name it `<id>-night.svg` next to `<id>.svg`. Nothing else needed.
- **Explicit:** set `"art": { "day": "foo.svg", "night": "foo-dark.svg" }`.

If no night art exists, the day art is used at night. Night art should be a
slightly dimmer / warmer version (see `paper-lantern-night.svg`). Recolour slots
carry across both variants.

---

## 5. Recolorable parts & color presets

### 5.1 One slot per recolorable part

In the definition:

```json
"colorSlots": [
  { "id": "glass", "label": "Glass", "default": "#f2b25c",
    "palette": ["#f2b25c", "#e88f9f", "#9dbfc9", "#fdf8ef"],
    "allowCustom": true }
]
```

In the SVG, paint that part with `var(--c-glass, #f2b25c)`:

```svg
<ellipse cx="60" cy="88" rx="52" ry="64" fill="var(--c-glass, #f2b25c)"/>
```

The editor shows swatches from `palette`, plus a free colour picker when
`allowCustom` is `true`.

> **Important:** recolouring works only when the SVG is **inlined** (not an
> `<img>`). The loader inlines automatically when `colorSlots` is non-empty, or
> when you set `"raw": true`.

### 5.2 Rules for recolourable SVGs

- Only use plain fills/strokes with `var(--c-<slot>, <fallback>)`.
- Don't hard-code a colour you want the designer to change.
- Non-recolourable details can be any fixed colour (shadows, outlines, etc.).
- Multiple slots are supported — each becomes its own control.

### 5.3 Suggested colour configurations (presets)

Presets set **several slots at once**, so a user can one-click a whole look:

```json
"presets": [
  { "id": "amber", "label": "Amber", "colors": { "glass": "#f2b25c" } },
  { "id": "rose",  "label": "Rose",  "colors": { "glass": "#e88f9f" } }
]
```

Presets appear as buttons under **Color presets** in the editor.

---

## 6. Effects (movement, glow, smoke)

Effects are declared under `"effect"`. Use a single object, or an **array** to
combine them (e.g. a lantern that glows and flickers).

```json
"effect": { "type": "sway", "amplitude": 3, "duration": 5, "origin": "top" }
```

| `type` | What it does | Options | Good for |
| --- | --- | --- | --- |
| `sway` | Gentle rotation pendulum | `amplitude` (deg), `duration` (s), `origin` (`top`/`bottom`) | Curtains, hanging plants, mobiles |
| `float` | Vertical bobbing | `amplitude` (px), `duration` (s) | Balloons, floating dust motes |
| `glow` | Soft bloom **at night only** | `color`, `duration` (s) | Lamps, string lights, lanterns, the window moon |
| `flicker` | Small brightness flicker | `duration` (s) | Candle/lamp flames (combine with `glow`) |
| `twinkle` | Opacity pulse | `duration` (s) | Stars, fairy lights |
| `smoke` | Rising puffs | `color`, `count` (1–8), `duration` (s) | Chai/chocolate, incense, candles |

### 6.1 Recipe: curtains that rock in the wind

```json
"effect": { "type": "sway", "amplitude": 3, "duration": 6, "origin": "top" }
```

Design the curtain so its **top** is the pivot. `origin: "top"` rotates around the
top edge (use `"bottom"` for things that pivot at their base).

### 6.2 Recipe: lights that glow at night

```json
"effect": [
  { "type": "glow", "color": "#ffcf6b", "duration": 3.5 },
  { "type": "flicker", "duration": 2.8 }
]
```

`glow` is **skipped during the day**, so the item looks normal in daylight and
blooms after dark. Add a `<name>-night.svg` so the bulb itself brightens too.

### 6.3 Recipe: smoke rising from chai

```json
"effect": { "type": "smoke", "color": "#ffffff", "count": 3, "duration": 3.6 }
```

The puffs rise from the **top-centre** of the item's bounding box. Position the
drink so the cup's rim is near the top of the art (`chai-cup.svg`).

### 6.4 Notes

- Effects respect `prefers-reduced-motion: reduce` (they are disabled for users
  who ask for less motion).
- `duration` is how long one loop takes; `delay` (seconds) offsets the start.
- Animations run continuously; keep them subtle.

---

## 7. Repeating textures (string lights, bunting, borders)

Add `"repeat"` to make an item **tile across the band** instead of drawing one
instance. Great for string lights across a wall, bunting, borders, wallpaper
strips, etc.

```json
{
  "kind": "room",
  "label": "Fairy lights",
  "category": "wallDecor",
  "layer": "wall",
  "band": "wall",
  "aspect": 2.66,
  "defaultScale": 0.14,
  "repeat": "x"
}
```

- `"repeat": "x"` tiles horizontally across the full width of the band;
  `"y"` tiles vertically; `"both"` tiles in both directions.
- Draw the SVG as a single **seamless segment** (its left and right edges should
  line up). The SVG must include a `viewBox` — its width ÷ height is the tile's
  intrinsic shape and drives the tiling. `defaultScale` is the strip's height
  relative to the band.
- **Positioning:** the strip spans the full band width, so the horizontal position
  does nothing; use `y` to move it up/down and `scale` for its height.
- **Recolouring works** for repeating items: the slots are substituted into the
  SVG and the result is tiled, so `colorSlots`/`presets` (§5) are fully supported.
  Repeating items ignore the drop shadow (they're a strip, not an object).
- Effects still apply (e.g. `"effect": { "type": "twinkle" }` makes the whole
  string twinkle) — see §6.

See `src/assets/svg/fairy-lights.{svg,json}` for a working example.

## 8. Embedding the definition in the SVG (advanced)

Instead of (or on top of) a sidecar JSON, put a JSON `<metadata>` block in the
SVG. This keeps art + config in one file:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <metadata>{"kind":"room","label":"Chai cup","category":"trinket","layer":"surface","band":"floor","aspect":1,"defaultScale":0.17,"attach":"furniture","effect":{"type":"smoke","count":3}}</metadata>
  … your art …
</svg>
```

If both exist, the **sidecar JSON wins** for the fields it sets (they are merged).

---

## 9. SVG authoring guidelines

- Set a `viewBox` and **omit** fixed `width`/`height` so the art scales cleanly
  (e.g. `<svg viewBox="0 0 120 200">`). The `aspect` = viewBox width ÷ height.
- Design at a comfortable size; exact on-screen size comes from `defaultScale`.
- For recolourable art, use `var(--c-<slot>, <fallback>)` (see §5).
- Keep art crisp with `stroke-linecap="round"`, `stroke-linejoin="round"`.
- The app sets `aria-hidden`/`draggable=false` for you; art should be decorative.
- Avoid `<script>`, external references, or embedded rasters — keep it pure SVG.

---

## 10. Icons (UI glyphs)

Small UI icons (buttons, layer rows) live in `src/assets/svg/icon-*.svg` and are
worn as CSS masks using a colour, so draw them as **single-colour silhouettes**.
Wiring one up requires one tiny CSS line, e.g.:

```css
.icon--basket { --icon: url('@/assets/svg/icon-basket.svg'); }
```

Then use `<span class="icon icon--basket"></span>`. (Decoration, stickers and
tape do not need this — they are data-driven via §2–§6.)

---

## 11. Testing your art

1. `pnpm dev` and open the app.
2. Room editor: click the pencil (desktop) → your item is in its category.
   - Toggle **Time of day** between *Day* and *Night* to check variants + glow.
   - Select it to see colour slots and presets.
3. Scrapbook editor: **Add to page** shows your stickers/tape.
4. Confirm motion is subtle and that recolouring affects the right parts.

## 12. Definition reference (all fields)

```jsonc
{
  "kind": "room",            // "room" | "sticker" | "tape"  (default "room")
  "id": "woven-basket",      // default: file name
  "label": "Woven basket",   // default: id

  // room only
  "category": "trinket",
  "layer": "surface",        // wall | floor | surface
  "band": "floor",           // wall | floor
  "aspect": 1.1,             // width / height
  "defaultScale": 0.18,
  "defaultRotation": 0,
  "attach": "furniture",     // furniture | shelf | any

  // sticker only
  "tint": false,
  "defaultColor": "#d9a94e",

  // tape only
  "opacity": 0.9,

  // shared
  "art": { "day": "woven-basket.svg", "night": "woven-basket-night.svg" },
  "raw": false,                       // force inline (auto-on with colorSlots)
  "repeat": "x",                      // room: tile across the band — "x" | "y" | "both"
  "colorSlots": [ { "id": "body", "label": "Weave", "default": "#d3b184",
                    "palette": ["#d3b184"], "allowCustom": true } ],
  "presets": [ { "id": "sage", "label": "Sage", "colors": { "body": "#9caf88" } } ],
  "effect": { "type": "sway", "amplitude": 2, "duration": 5, "origin": "top" }
}
```

That's everything you need — drop in SVGs (+ optional JSON) and they ship with the app.
