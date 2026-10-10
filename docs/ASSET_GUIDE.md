# Journeybook — Asset & Decoration Guide

This guide is for designers/artists adding **new art** to Journeybook: room decor,
scrapbook stickers, tape, frames, and papers — including **animations** (things
that sway, glow, drift), **particle effects** (smoke, fireflies, zzz…), optional
**day/night variants** (room items), and **recolorable** parts with suggested
**color presets**.

You do **not** need to edit application code. You add SVG files (and, optionally,
a small JSON definition next to them) and they appear in the app automatically.

> All art lives as one-file-per-asset in `src/assets/svg/` (see `AGENTS.md` §9).
> Animations and particles never require a new "type" in code — everything is
> data you can write in JSON.

---

## 1. How the loader works

On build/dev, Journeybook scans `src/assets/svg/`:

- Every `*.svg` is available as art.
- A `*.json` **sidecar** file (same base name, e.g. `paper-lantern.json`) registers
  that SVG as an asset, OR
- an SVG can embed its own definition inside a `<metadata>` block.

If an SVG has **neither** a sidecar JSON nor embedded metadata, it is ignored by
the decor system (so UI icons and one-off art are unaffected).

The **id** defaults to the file base name (`paper-lantern.svg` → `paper-lantern`),
and the **art** defaults to `<id>.svg`.

**Examples shipped with the app** (use these as templates):

| File                                                                           | Shows                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `trailing-plant.{svg,json}`                                                    | sway animation, 2 color slots, presets, **night-only firefly particles** |
| `paper-lantern.{svg,json}` + `paper-lantern-night.svg`                         | day/night variants, night glow + flicker                                 |
| `chai-cup.{svg,json}`                                                           | smoke (particle)                                                        |
| `fairy-lights.{svg,json}`                                                      | **repeating** texture across the wall, recolour presets                  |
| `sticker-moon.{svg,json}`                                                      | **sticker** with 2 slots, presets, twinkle animation                     |
| `sticker-heart-burst.{svg,json}`                                               | **sticker** with a particle system (heart sparks)                        |
| `frame-stitched.{svg,json}`                                                    | **frame** overlay with a recolourable border                             |
| `paper-meadow.{svg,json}` + `paper-tile-dots/border-stitch/corner-blossom.svg` | **paper** with fill tile + edge border + corner motifs, 4 slots          |

---

## 2. Asset kinds

Set `"kind"` in the definition (default `"room"`):

- `"room"` — furniture / wall decor / trinkets / pets placed in the shared room.
- `"sticker"` — a decoration placed on a scrapbook page.
- `"tape"` — a washi/masking strip placed on a scrapbook page.
- `"frame"` — a photo frame overlay (scrapbook image elements).
- `"paper"` — a scrapbook page paper (base colour + optional tile/border/corners).

---

## 3. Quick start (a new room decoration)

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

## 4. Room decor fields

| Field             | Type                                                                          | Notes                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`              | string                                                                        | Defaults to the file name.                                                                                                 |
| `label`           | string                                                                        | Shown in the editor palette.                                                                                               |
| `category`        | `wallpaper` \| `flooring` \| `furniture` \| `wallDecor` \| `trinket` \| `pet` | Palette group.                                                                                                             |
| `layer`           | `wall` \| `floor` \| `surface`                                                | `wall`/`floor` are placed in that band; `surface` items rest on hosts or anywhere. Stacking is by **Depth**, not by layer. |
| `band`            | `wall` \| `floor` \| `both`                                                   | Which band its position is measured in (`both` = whole stage).                                                             |
| `aspect`          | number                                                                        | width ÷ height (from your `viewBox`).                                                                                      |
| `defaultScale`    | number                                                                        | Size relative to the band height (≈ `1` fills the band).                                                                   |
| `defaultRotation` | number                                                                        | Degrees.                                                                                                                   |
| `attach`          | `furniture` \| `shelf` \| `any`                                               | For `surface` items (things that rest on furniture/shelves).                                                               |
| `host`            | boolean                                                                       | Marks this item as a **resting surface** that can hold `surface` items (desk, shelf).                                      |
| `repeat`          | `"x"` \| `"y"` \| `"both"`                                                    | Tile across the band instead of one instance (see §9).                                                                     |
| `effect`          | object \| array \| null                                                       | Shortcut recipes, see §7.1.                                                                                                |
| `animations`      | array                                                                         | Generic animations, see §7.                                                                                                |
| `particles`       | array                                                                         | Generic particle systems, see §8.                                                                                          |
| `colorSlots`      | array                                                                         | See §6.                                                                                                                    |
| `presets`         | array                                                                         | See §6.3.                                                                                                                  |
| `art`             | `{ day, night }`                                                              | See §5.                                                                                                                    |
| `raw`             | boolean                                                                       | Force inlining the SVG (needed for recolor). Auto-on when `colorSlots` exist.                                              |

### 4.1 Surface items & hosting (wall **or** floor)

`layer: "surface"` items (trinkets, pets) rest on a host piece of furniture — a
floor desk/beanbag **or** a wall shelf. Only items marked `"host": true` can hold
them. Set `attach` to say what may host the item:

| `attach`                | Hosts                                              |
| ----------------------- | -------------------------------------------------- |
| `furniture` (and `any`) | any resting surface (desk, beanbag, wall shelf, …) |
| `shelf`                 | wall-decor hosts only (the wall shelf)             |

> `any` is the default. Today `furniture` and `any` are equivalent (both accept
> any host surface); `shelf` narrows to wall decor.

At runtime the item is positioned **relative to its host**, so it stays put when
the host moves and looks the same whether the host is on the wall or the floor
(its size is measured against the item's own band, not the host). A **loose**
surface item (not on a host) can be dragged anywhere on the stage — floor or
wall — and dropped onto a host later.

> The host association and its offsets are stored **per placement**, not in the
> asset. A `surface` asset declares `layer: "surface"` and `attach`; a piece of
> furniture or shelf that can hold items sets `"host": true`.

Separately, `"band": "both"` on any asset measures its position against the whole
stage (top `0` → bottom `1`) instead of one band — useful for a tall object that
crosses the wall/floor line.

### 4.2 Editing tips (room editor)

- **Depth** is a single absolute scale across the whole room (wall decor, floor
  furniture and surface items all share it), so any item can be layered in front
  of or behind any other. New items are added on top.
- A **buried** item stays at its own depth; select it from the **Items** list in
  the editor (or click the same spot repeatedly to cycle through the stack) and
  move it with the X/Y sliders, or grab any visible part.
- While you drag an item, a **translucent preview** follows the cursor at the top
  layer; the real item keeps its own depth. Dragging a surface item onto a host
  attaches it; dragging it off detaches it.

---

## 5. Day & night variants (room only)

The room has a shared day/night state. Any **room** item can provide a night image
and, optionally, different visuals for each time of day. (Stickers, tape, frames
and paper are static keepsakes and do not change with time of day.)

The simplest form uses file names:

```json
"art": { "day": "lantern.svg", "night": "lantern-night.svg" }
```

- **Auto-detect:** name a file `<id>-night.svg` next to `<id>.svg`. Nothing else needed.
- If no night art exists, the day art is used at night.
- Night art should be a slightly dimmer / warmer version (see `paper-lantern-night.svg`).
- Recolour slots carry across both variants.

### 5.1 Different animations/particles per variant

Instead of a file name, each variant can be an **object** with its own visuals.
These are added on top of the item-level `animations`/`particles` and only run at
that time of day:

```json
"art": {
  "day": "trailing-plant.svg",
  "night": {
    "src": "trailing-plant.svg",
    "particles": [
      { "name": "firefly", "count": 5, "duration": 5, "size": 8, "jitter": 0.7,
        "spawn": { "x": 50, "y": 62, "spreadX": 20, "spreadY": 18 },
        "shape": { "kind": "svg", "svg": "particle-firefly.svg", "color": "#ffd76b" } }
    ]
  }
}
```

---

## 6. Recolorable parts & color presets

### 6.1 One slot per recolorable part

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

### 6.2 Where recolouring works in each kind

| Kind           | How recolour is applied                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| room           | SVG is **inlined** (auto when `colorSlots` exist, or `"raw": true`).                                                                                                                                   |
| room `repeat`  | Slots are substituted into the SVG, then the result is tiled.                                                                                                                                          |
| sticker / tape | SVG is inlined when the definition has `colorSlots`.                                                                                                                                                   |
| frame          | Overlay SVG is inlined when the definition has `colorSlots`.                                                                                                                                           |
| paper          | `border`/`corners` are inlined. **`fill`** tiles are baked into a data URL (external tile images cannot read CSS variables), so use a `colorSlots` entry for the fill too if you want it recolourable. |

> **Important:** recolouring only works when the SVG is **inlined** (not an
> `<img>`). For room items this happens automatically when `colorSlots` is
> non-empty, or when you set `"raw": true`.

### 6.3 Rules for recolourable SVGs

- Only use plain fills/strokes with `var(--c-<slot>, <fallback>)`.
- Don't hard-code a colour you want the designer to change.
- Non-recolourable details can be any fixed colour (shadows, outlines, etc.).
- Multiple slots are supported — each becomes its own control.
- Fallbacks may contain parentheses, e.g. `var(--c-dot, rgba(74,59,46,0.18))`.

### 6.4 Suggested colour configurations (presets)

Presets set **several slots at once**, so a user can one-click a whole look. They
appear as buttons in the editor for whichever kind defines them:

```json
"presets": [
  { "id": "amber", "label": "Amber", "colors": { "glass": "#f2b25c" } },
  { "id": "rose",  "label": "Rose",  "colors": { "glass": "#e88f9f" } }
]
```

For papers, a preset can set slots across layers:

```json
{
  "id": "meadow",
  "label": "Meadow",
  "colors": {
    "edge": "#cfe3c5",
    "dot": "rgba(156,175,136,0.5)",
    "leaf": "#7e8f6b",
    "blossom": "#f6e8a8"
  }
}
```

---

## 7. Animations

Animations move an object **as a whole** (they intentionally do not move separate
parts of the SVG). They are defined purely as data: a list of **keyframe stops**
over any combination of `transform`, `opacity`, `filter`, and CSS custom
properties. There are no built-in motion types — sway, bob, pulse, shake, drift…
are all just keyframes you write.

```json
"animations": [
  {
    "name": "bob",
    "duration": "5s",
    "timing": "ease-in-out",
    "iterations": "infinite",
    "origin": "50% 100%",
    "vars": { "--bob": "6px" },
    "keyframes": [
      { "at": 0,   "transform": "translateY(0)" },
      { "at": 50,  "transform": "translateY(calc(var(--bob) * -1))" },
      { "at": 100, "transform": "translateY(0)" }
    ]
  }
]
```

### 7.1 Animation definition (`AnimationDef`)

| Field        | Type    | Notes                                                             |
| ------------ | ------- | ----------------------------------------------------------------- |
| `name`       | string  | Optional. Adds an `fx--<name>` class for styling/targeting.       |
| `keyframes`  | array   | Required. Ordered stops (see below).                              |
| `duration`   | string  | e.g. `"4s"`. Default `"4s"`.                                      |
| `timing`     | string  | CSS `animation-timing-function`. Default `"ease-in-out"`.         |
| `delay`      | string  | e.g. `"0.5s"`. Default `"0s"`.                                    |
| `direction`  | string  | `"normal"` \| `"alternate"` \| … Default `"normal"`.              |
| `iterations` | string  | e.g. `"infinite"` or `"3"`. Default `"infinite"`.                 |
| `fill`       | string  | CSS `animation-fill-mode`. Default `"both"`.                      |
| `origin`     | string  | `transform-origin`, e.g. `"50% 100%"`.                            |
| `vars`       | object  | CSS custom properties referenced by the keyframes.                |
| `bloom`      | boolean | Draw a soft radial glow behind the art (used by the glow recipe). |

**Keyframe stop fields:**

| Field       | Type   | Notes                                                    |
| ----------- | ------ | -------------------------------------------------------- |
| `at`        | number | Percentage through the timeline, `0`–`100`.              |
| `transform` | string | e.g. `"translateY(-220%) scale(1.7)"`, `"rotate(4deg)"`. |
| `opacity`   | number | `0`–`1`.                                                 |
| `filter`    | string | e.g. `"blur(1px) brightness(1.2)"`.                      |
| `vars`      | object | CSS custom properties set at this stop.                  |

Use `vars` + `calc()` to parameterise a repeating motion once and reuse it.

### 7.2 Shortcut recipes (`effect`)

For convenience, the common motions still have one-line shortcuts under
`"effect"` (single object or array). They are exactly the same data engine; the
shortcut just saves typing.

```json
"effect": { "type": "sway", "amplitude": 3, "duration": 5, "origin": "top" }
```

| `type`    | What it does                     | Options                                                      |
| --------- | -------------------------------- | ------------------------------------------------------------ |
| `sway`    | Gentle rotation pendulum         | `amplitude` (deg), `duration` (s), `origin` (`top`/`bottom`) |
| `float`   | Vertical bobbing                 | `amplitude` (px), `duration` (s)                             |
| `flicker` | Small brightness flicker         | `duration` (s)                                               |
| `twinkle` | Opacity pulse                    | `duration` (s)                                               |
| `glow`    | Soft bloom **at night only**     | `color`, `duration` (s)                                      |
| `smoke`   | Rising puffs (a particle system) | `count` (1–8), `duration` (s)                                |

Combine several with an array (e.g. a lantern that glows and flickers):

```json
"effect": [
  { "type": "glow", "color": "#ffcf6b", "duration": 3.5 },
  { "type": "flicker", "duration": 2.8 }
]
```

`effect` recipes and generic `animations`/`particles` can be mixed freely.

### 7.3 Notes

- Animations are disabled for users who set **prefers-reduced-motion: reduce**.
- `duration` is one loop; `delay` offsets the start.
- Animations run continuously; keep them subtle.

---

## 8. Particles

Particles are tiny, repeatedly-spawned shapes inside the item's box. Nothing is
hard-coded: the shape is art (any SVG or a plain circle), and the motion is a set
of keyframes. Smoke, fireflies, zzz, bubbles, sparks, falling leaves… are all just
configurations.

```json
"particles": [
  {
    "name": "smoke",
    "count": 3,
    "duration": 3.6,
    "size": 16,
    "jitter": 0.4,
    "opacity": 1,
    "spawn": { "x": 50, "y": 2 },
    "shape": { "kind": "circle" },
    "motion": {
      "keyframes": [
        { "at": 0,   "opacity": 0, "transform": "translateY(0) scale(0.6)" },
        { "at": 25,  "opacity": 0.65 },
        { "at": 100, "opacity": 0, "transform": "translateY(-220%) scale(1.7)" }
      ]
    }
  }
]
```

### 8.1 Particle definition (`ParticleDef`)

| Field      | Type         | Notes                                                                                         |
| ---------- | ------------ | --------------------------------------------------------------------------------------------- |
| `name`     | string       | Optional. Adds an `fx-<name>` class (e.g. `fx-smoke`).                                        |
| `count`    | number       | Particles in flight (clamped 1–24). Default 3.                                                |
| `shape`    | object       | See §8.2. Default: a soft white circle.                                                       |
| `spawn`    | object       | `{ x, y, spreadX, spreadY }` in % of the item box. Centre default `50 / 4`.                   |
| `motion`   | AnimationDef | The particle's life; keyframes drive its transform/opacity. Defaults to a rise-and-fade puff. |
| `duration` | number       | Lifetime in **seconds**. Default 3.4.                                                         |
| `delay`    | number       | Start offset in **seconds**.                                                                  |
| `stagger`  | number       | Seconds between successive particles. Default `duration / count`.                             |
| `size`     | number       | Particle width as a % of the item box. Default 16.                                            |
| `jitter`   | number       | 0–1. Randomises each particle's delay, offset and scale.                                      |
| `opacity`  | number       | Opacity ceiling. Default 1.                                                                   |
| `blend`    | string       | Optional CSS `mix-blend-mode` (e.g. `"screen"`).                                              |

### 8.2 Particle shapes

- `{ "kind": "circle" }` — a soft radial dot. Add `"color"` for a solid dot.
- `{ "kind": "svg", "svg": "particle-firefly.svg" }` — an SVG drawn as-is.
- `{ "kind": "svg", "svg": "my-shape.svg", "color": "#ffd76b" }` — an SVG tinted
  with `color` (its silhouette/alpha is used, so draw a solid shape).
- `blur` (number, px) softens any shape.

`svg` accepts a bare `assets/svg` **file name** (recommended), an asset URL, or a
data URL. Commit your particle shapes as their own SVGs.

> Tip: a particle that should look like the item (e.g. zzz from a sleeping
> animal) is just a small SVG plus a rising/drifting `motion`.

---

## 9. Repeating textures (room; string lights, bunting, borders)

Add `"repeat"` to make a room item **tile across the band** instead of drawing one
instance:

```json
{
  "kind": "room",
  "category": "wallDecor",
  "layer": "wall",
  "band": "wall",
  "aspect": 2.66,
  "defaultScale": 0.14,
  "repeat": "x"
}
```

- `"repeat": "x"` tiles horizontally; `"y"` vertically; `"both"` both ways.
- Draw a single **seamless segment** (edges line up) and include a `viewBox`; its
  width ÷ height drives the tiling. `defaultScale` is the strip height.
- Recolouring works (slots are substituted, then tiled). Repeating items ignore
  the drop shadow.
- `animations`/`particles` still apply.

See `fairy-lights.{svg,json}`.

---

## 10. Stickers

Stickers live on scrapbook pages. They support full recolouring (one or many
slots), presets, animations and particles — same engine as room items.

```json
{
  "kind": "sticker",
  "label": "Dreamy moon",
  "aspect": 1,
  "colorSlots": [
    {
      "id": "body",
      "label": "Moon",
      "default": "#e8d3b0",
      "palette": ["#e8d3b0", "#f6e8a8", "#cfe0ea"],
      "allowCustom": true
    },
    {
      "id": "crater",
      "label": "Craters",
      "default": "#d3b184",
      "palette": ["#d3b184", "#b99362"],
      "allowCustom": true
    }
  ],
  "presets": [
    { "id": "honey", "label": "Honey", "colors": { "body": "#f6e8a8", "crater": "#d9a94e" } }
  ],
  "animations": [
    {
      "name": "twinkle",
      "duration": "3s",
      "keyframes": [
        { "at": 0, "opacity": 0.72 },
        { "at": 50, "opacity": 1 },
        { "at": 100, "opacity": 0.72 }
      ]
    }
  ]
}
```

**Two ways to make a sticker:**

1. **Silhouette (`tint: true`)** — draw a solid shape; the user picks one colour
   (rendered as a mask). Best for simple doodles.
   ```json
   {
     "kind": "sticker",
     "label": "Tiny heart",
     "tint": true,
     "defaultColor": "#d98c8c",
     "aspect": 1
   }
   ```
2. **Full colour** — leave `tint` off. Add `colorSlots` for multi-part recolour
   (the SVG is inlined). Without `colorSlots` it renders as-is.

`aspect` = viewBox width ÷ height. Stickers can also have `particles` /
`animations` (see `sticker-heart-burst`).

---

## 11. Tape

Tape is a strip placed on a page. By default the SVG is used as a **mask** filled
with one colour — design a solid silhouette (alpha matters; ink colour is ignored).

```json
{
  "kind": "tape",
  "label": "Gingham tape",
  "aspect": 3.4,
  "defaultColor": "#cfe3c5",
  "opacity": 0.9
}
```

Tape also accepts `colorSlots` (multi-colour, inlined), `presets`, `animations`
and `particles` exactly like stickers.

---

## 12. Frames

A frame is an **overlay SVG** drawn on top of a photo. Design it at any viewBox:
the overlay is stretched to the element's box, and the region that should show the
photo must be **transparent** (a hole). `insets` tell the app where that window is
(used to size/crop the photo and to set the element's aspect).

```json
{
  "kind": "frame",
  "label": "Stitched",
  "insets": { "l": 0.1, "r": 0.1, "t": 0.1, "b": 0.1 },
  "colorSlots": [
    {
      "id": "stitch",
      "label": "Border",
      "default": "#fdf8ef",
      "palette": ["#fdf8ef", "#f6e8a8", "#cfe3c5", "#3b3a44"],
      "allowCustom": true
    }
  ],
  "presets": [{ "id": "mint", "label": "Mint", "colors": { "stitch": "#cfe3c5" } }]
}
```

| Field                      | Type                   | Notes                                                               |
| -------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `insets`                   | `{ l, r, t, b }`       | **Required.** Window insets as fractions of the element box (0–1).  |
| `contentAspect`            | number                 | Fixes the photo's crop aspect (w/h). Omit to match the element box. |
| `clip`                     | `"circle"` \| `"arch"` | Optional window clip shape.                                         |
| `radius`                   | number                 | Rounded window corners (px).                                        |
| `bg`                       | string                 | Optional filled backing behind the photo (default transparent).     |
| `colorable`                | boolean                | Allow a single free colour for `bg` (built-in style).               |
| `caption`                  | boolean                | Show the photo caption at the bottom.                               |
| `colorSlots` / `presets`   | array                  | Recolour the overlay (SVG is inlined).                              |
| `animations` / `particles` | array                  | Optional motion (e.g. a sparkling frame).                           |

> The overlay is stretched to the element's aspect ratio, so keep border art
> tolerant of stretching or design near-square frames and set `contentAspect`.

---

## 13. Papers

A **paper** is the page background. It is a base colour plus any of three optional
layers, all defined with your own SVGs:

- `fill` — a **repeating pattern** tiled across the whole page.
- `border` — a decorative band around the **edge** (transparent centre).
- `corners` — a **corner motif**, drawn once and mirrored into all four corners.

```json
{
  "kind": "paper",
  "label": "Meadow",
  "color": "#fdf8ef",
  "lined": false,
  "fill": {
    "art": "paper-tile-dots.svg",
    "scale": 0.1,
    "colorSlots": [
      {
        "id": "dot",
        "label": "Dots",
        "default": "rgba(74,59,46,0.18)",
        "palette": ["rgba(74,59,46,0.18)", "rgba(156,175,136,0.5)"],
        "allowCustom": true
      }
    ]
  },
  "border": {
    "art": "paper-border-stitch.svg",
    "colorSlots": [
      {
        "id": "edge",
        "label": "Edge",
        "default": "#e8d3c0",
        "palette": ["#e8d3c0", "#cfe3c5"],
        "allowCustom": true
      }
    ]
  },
  "corners": {
    "art": "paper-corner-blossom.svg",
    "colorSlots": [
      {
        "id": "leaf",
        "label": "Leaves",
        "default": "#9caf88",
        "palette": ["#9caf88", "#7e8f6b"],
        "allowCustom": true
      },
      {
        "id": "blossom",
        "label": "Blossoms",
        "default": "#e8b4af",
        "palette": ["#e8b4af", "#d98c8c"],
        "allowCustom": true
      }
    ],
    "presets": [
      {
        "id": "meadow",
        "label": "Meadow",
        "colors": {
          "edge": "#cfe3c5",
          "dot": "rgba(156,175,136,0.5)",
          "leaf": "#7e8f6b",
          "blossom": "#f6e8a8"
        }
      }
    ]
  }
}
```

**Base fields:**

| Field   | Type    | Notes                                     |
| ------- | ------- | ----------------------------------------- |
| `color` | string  | Base page colour.                         |
| `ink`   | string  | Colour of the ruled lines (when `lined`). |
| `lined` | boolean | Draw horizontal rules.                    |
| `dark`  | boolean | Marks a dark page (adjusts text ink).     |

**Each layer (`fill` / `border` / `corners`):**

| Field                    | Type   | Notes                                                            |
| ------------------------ | ------ | ---------------------------------------------------------------- |
| `art`                    | string | Bare `assets/svg` file name (or url/data-url).                   |
| `opacity`                | number | 0–1.                                                             |
| `scale`                  | number | `fill` only: tile size as a fraction of the page (default 0.12). |
| `colorSlots` / `presets` | array  | Recolour the layer.                                              |

Notes:

- Give every slot across all layers a **unique `id`** (e.g. `dot`, `edge`, `leaf`).
- `border` art is **stretched** to the page; keep it symmetric.
- `corners` art is drawn for the **top-left** and mirrored (`scale`) into the other
  three corners. It is sized to ~22% of the page width; leave a little padding.
- `fill` art is tiled; its colours are baked in, so use a `colorSlots` entry with a
  matching `var(--c-<id>, …)` in the tile if you want it recolourable.

---

## 14. Embedding the definition in the SVG (advanced)

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

## 15. SVG authoring guidelines

- Set a `viewBox` and **omit** fixed `width`/`height` so the art scales cleanly
  (e.g. `<svg viewBox="0 0 120 200">`). The `aspect` = viewBox width ÷ height.
- Design at a comfortable size; exact on-screen size comes from `defaultScale`.
- For recolourable art, use `var(--c-<slot>, <fallback>)` (see §6).
- Keep art crisp with `stroke-linecap="round"`, `stroke-linejoin="round"`.
- The app sets `aria-hidden`/`draggable=false` for you; art should be decorative.
- Avoid `<script>`, external references, or embedded rasters — keep it pure SVG.
- Particle/tile shapes drawn for masking should be **solid** (their alpha is used).

---

## 16. Icons (UI glyphs)

Small UI icons (buttons, layer rows) live in `src/assets/svg/icon-*.svg` and are
worn as CSS masks using a colour, so draw them as **single-colour silhouettes**.
Wiring one up requires one tiny CSS line, e.g.:

```css
.icon--basket {
  --icon: url('@/assets/svg/icon-basket.svg');
}
```

Then use `<span class="icon icon--basket"></span>`. (Decor, stickers, tape,
frames and papers do not need this — they are data-driven via §2–§13.)

---

## 17. Testing your art

1. `pnpm dev` and open the app.
2. Room editor: click the pencil (desktop) → your item is in its category.
   - Toggle **Time of day** between _Day_ and _Night_ to check variants, glow and
     night-only particles.
   - Select it to see colour slots and presets; watch the animation/particles.
   - For a `surface` item, drop it onto a host (a desk/shelf with `"host": true`)
     to attach it, and drag it off to detach; a loose one can go anywhere on the
     stage. Use **Depth** to layer it, and the **Items** list (or repeated clicks)
     to select something buried.
3. Scrapbook: **Add to page** shows your stickers and tape; the image editor's
   **Frame** row shows your frames; the **Paper** swatches show your papers.
   - Select a recolourable sticker/tape to see its slots and presets.
   - Pick a paper, then set its **paper colors** (slots/presets).
4. Confirm motion is subtle and that recolouring affects the right parts.

---

## 18. Definition reference (all fields)

```jsonc
{
  "kind": "room", // "room" | "sticker" | "tape" | "frame" | "paper"
  "id": "woven-basket", // default: file name
  "label": "Woven basket", // default: id

  // room only
  "category": "trinket",
  "layer": "surface", // wall | floor | surface
  "band": "floor", // wall | floor | both
  "aspect": 1.1, // width / height
  "defaultScale": 0.18,
  "defaultRotation": 0,
  "attach": "furniture", // furniture | shelf | any
  "host": false, // true = can hold surface items (desk, shelf)
  "repeat": "x", // "x" | "y" | "both"

  // sticker / tape only
  "tint": false,
  "defaultColor": "#d9a94e",
  "opacity": 0.9, // tape

  // frame only
  "insets": { "l": 0.1, "r": 0.1, "t": 0.1, "b": 0.1 },
  "contentAspect": 1,
  "clip": "arch", // "circle" | "arch"
  "radius": 0,
  "caption": false,
  "bg": "#fdf8ef",
  "colorable": false,

  // paper only
  "color": "#fdf8ef",
  "ink": "rgba(74,59,46,0.05)",
  "lined": true,
  "dark": false,
  "fill": { "art": "tile.svg", "scale": 0.1, "opacity": 1, "colorSlots": [], "presets": [] },
  "border": { "art": "border.svg", "opacity": 1, "colorSlots": [], "presets": [] },
  "corners": { "art": "corner.svg", "opacity": 1, "colorSlots": [], "presets": [] },

  // shared
  "art": { "day": "woven-basket.svg", "night": "woven-basket-night.svg" },
  // each value: file name OR { src, animations, particles }
  "raw": false, // room: force inline (auto-on with colorSlots)
  "colorSlots": [
    {
      "id": "body",
      "label": "Weave",
      "default": "#d3b184",
      "palette": ["#d3b184"],
      "allowCustom": true,
    },
  ],
  "presets": [{ "id": "sage", "label": "Sage", "colors": { "body": "#9caf88" } }],

  // motion (all kinds; §7 and §8)
  "effect": { "type": "sway", "amplitude": 2, "duration": 5, "origin": "top" },
  "animations": [
    {
      "name": "bob",
      "duration": "5s",
      "keyframes": [
        { "at": 0, "transform": "translateY(0)" },
        { "at": 50, "transform": "translateY(-6px)" },
        { "at": 100, "transform": "translateY(0)" },
      ],
    },
  ],
  "particles": [
    {
      "name": "spark",
      "count": 6,
      "duration": 2.6,
      "size": 12,
      "jitter": 0.8,
      "spawn": { "x": 50, "y": 40, "spreadX": 15, "spreadY": 10 },
      "shape": { "kind": "svg", "svg": "doodle-heart.svg", "color": "#d98c8c" },
      "motion": {
        "keyframes": [
          { "at": 0, "opacity": 0 },
          { "at": 30, "opacity": 1 },
          { "at": 100, "opacity": 0, "transform": "translateY(-40%) scale(1)" },
        ],
      },
    },
  ],
}
```

That's everything you need — drop in SVGs (+ optional JSON) and they ship with the app.
