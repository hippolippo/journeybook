# Room decoration fields

Authoritative semantics are in `docs/ASSET_GUIDE.md`. This is the quick
reference the skill generates against.

## Placement matrix

| `category`  | Typical `layer` | Typical `band` | Resting on a host?                    |
| ----------- | --------------- | -------------- | ------------------------------------- |
| `wallpaper` | `wall`          | `wall`         | no                                    |
| `flooring`  | `floor`         | `floor`        | no                                    |
| `furniture` | `floor`         | `floor`        | no (may set `host: true`)             |
| `wallDecor` | `wall`          | `wall`         | no (may set `host: true` for shelves) |
| `trinket`   | `surface`       | `floor`        | yes → `attach`                        |
| `pet`       | `surface`       | `floor`        | yes → `attach`                        |

- `layer: "surface"` items rest **relative to a host**. They must declare
  `attach`:
  - `"furniture"` or `"any"` → any resting surface (floor desk/beanbag or wall shelf).
  - `"shelf"` → wall-decor hosts only.
- A host (a piece of furniture or a wall shelf) sets `"host": true` and stays on
  `layer` `floor`/`wall`. A surface item can never be a host.
- `band: "both"` measures position against the whole stage (tall objects crossing
  the wall/floor line).
- `repeat: "x" | "y" | "both"` tiles the art across the band (string lights,
  bunting, borders). Draw one seamless segment.

## Room fields

| Field             | Type                            | Notes                                                   |
| ----------------- | ------------------------------- | ------------------------------------------------------- |
| `kind`            | `"room"`                        | Default; only `"room"` is valid for this skill.         |
| `id`              | string                          | Defaults to the SVG file name.                          |
| `label`           | string                          | Shown in the editor palette.                            |
| `category`        | enum                            | See matrix.                                             |
| `layer`           | `wall` \| `floor` \| `surface`  | See matrix.                                             |
| `band`            | `wall` \| `floor` \| `both`     | Position band.                                          |
| `aspect`          | number                          | `viewBox` width ÷ height.                               |
| `defaultScale`    | number                          | Size vs band height (≈ 1 fills the band).               |
| `defaultRotation` | number                          | Degrees.                                                |
| `attach`          | `furniture` \| `shelf` \| `any` | Surface items only.                                     |
| `host`            | boolean                         | Marks a resting surface; wall/floor only.               |
| `repeat`          | `"x"` \| `"y"` \| `"both"`      | Tiling.                                                 |
| `art`             | `{ day, night }`                | Each is a file name or `{ src, scale?, particles?, animations? }`. A lone day SVG auto-detects `<id>-night.svg`. |
| `artAnchor`       | enum                            | Day/night overlay: `top/center/bottom` × `left/center/right` (default `bottom-center`). |
| `colorSlots`      | array                           | One per `var(--c-<id>, …)` in the art.                  |
| `presets`         | array                           | Named multi-slot colour combos.                         |
| `effect`          | object \| array                 | Shortcut motion recipes (§7.2 of the guide).            |
| `animations`      | array                           | Data-defined whole-object animation.                    |
| `particles`       | array                           | Data-defined particle systems.                          |
| `lights`          | array                           | Emissive light sources (see Lights below).              |
| `raw`             | boolean                         | Auto-on when `colorSlots` exist; rarely needed.         |

## Day / night

- Naming `<name>-night.svg` is enough (auto-detected).
- Passing `--night` writes an explicit `art`:

  ```json
  "art": { "day": "example-lamp.svg", "night": "example-lamp-night.svg" }
  ```

- Night-only motion lives on the night variant (item-level motion still runs at
  all times):

  ```json
  "art": {
    "day": "bernese-mountain-puppy.svg",
    "night": {
      "src": "bernese-mountain-puppy-night.svg",
      "particles": [ { "name": "zzz", "count": 3, "duration": 4 } ]
    }
  }
  ```

- Day and night viewBoxes do **not** have to match. At load the two viewBoxes are
  merged into one shared frame, keeping the size baked into each SVG (so the
  item never jumps or rescales between day and night). Tune the relative size
  with a per-variant `scale` offset (default `1`); the item `aspect` is derived
  from the merged frame:

  ```json
  "art": {
    "day":   { "src": "raccoon.svg",       "scale": 1.0 },
    "night": { "src": "raccoon-night.svg", "scale": 1.1 }
  }
  ```

- `artAnchor` controls how the two boxes overlay in that frame:
  `top-left` … `bottom-right` (or `center`). Default `bottom-center` (both rest
  on the same baseline and share a horizontal centre):

## Color slots & presets

```json
"colorSlots": [
  { "id": "body", "label": "Weave", "default": "#d3b184",
    "palette": ["#d3b184", "#c97b5a", "#9caf88", "#9dbfc9"], "allowCustom": true }
],
"presets": [
  { "id": "sage", "label": "Sage", "colors": { "body": "#9caf88" } }
]
```

Rules: one slot per recolorable part; the SVG paints it with
`var(--c-<id>, <fallback>)`; `default` should equal the fallback; every preset
key must be a declared slot id. Slot ids are unique; multiple slots are fine.

## Motion templates (only when the user asks)

Shortcut recipes (`effect`):

```json
"effect": { "type": "sway", "amplitude": 3, "duration": 5, "origin": "top" }
```

Types: `sway` (`amplitude` deg, `origin` `top`/`bottom`), `float` (`amplitude`
px), `flicker`, `twinkle`, `glow` (night-only, `color`), `smoke` (particles,
`count`, `color`). Combine with an array.

Generic animation (`animations`) — keyframe stops over `transform`, `opacity`,
`filter`, `vars`:

```json
"animations": [
  { "name": "bob", "duration": "5s",
    "keyframes": [
      { "at": 0, "transform": "translateY(0)" },
      { "at": 50, "transform": "translateY(-6px)" },
      { "at": 100, "transform": "translateY(0)" }
    ] }
]
```

Particle system (`particles`):

```json
"particles": [
  { "name": "spark", "count": 6, "duration": 2.6, "size": 18, "jitter": 0.9,
    "spawn": { "x": 50, "y": 46, "spreadX": 26, "spreadY": 20 },
    "shape": { "kind": "svg", "svg": "doodle-heart.svg", "color": "#d98c8c" },
    "motion": { "keyframes": [
      { "at": 0, "opacity": 0, "transform": "scale(0.3)" },
      { "at": 30, "opacity": 1 },
      { "at": 100, "opacity": 0, "transform": "translateY(-45%) scale(1)" }
    ] } }
]
```

Particle/tile shapes drawn for masking should be solid; commit them as their own
SVG under `src/assets/svg/` (kebab-case) and reference them by bare file name.

## Lights (room only)

Emit light from the item at night. Full semantics: `docs/ASSET_GUIDE.md` §10.

```json
"lights": [
  { "type": "lamp", "distribution": "spot", "slot": "bulb",
    "x": 50, "y": 20, "radius": 320, "angle": 60, "direction": 90, "penumbra": 0.4 }
]
```

| Field          | Type                                                         | Notes                                                    |
| -------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `id`           | string                                                       | Optional stable key.                                     |
| `type`         | `lamp` \| `candle` \| `firefly` \| `string` \| `window` \| `screen` \| `moon` | Fixture defaults + default distribution. |
| `distribution` | `point` \| `semi` \| `diffuse` \| `spot` \| `wash` \| `ambient` | How it spreads (overrides the type default).            |
| `x` / `y`      | number                                                       | Centre, % of the item box (default 50).                  |
| `radius`       | number                                                       | Reach, % of the item height (default from type).         |
| `intensity`    | number                                                       | Multiplier on the type default (default 1).              |
| `color`        | string                                                       | Literal colour (used when `slot` is absent).             |
| `slot`         | string                                                       | A `colorSlots` id — makes the light follow recolouring.  |
| `flicker`      | boolean                                                      | Strong flicker (types already set a mild default).       |
| `repeat`       | `"x"` \| `"y"` \| `"both"`                                   | Tile the light with a `repeat` item's art.               |
| `angle`        | number                                                       | `spot`/`wash`: cone full angle in degrees.               |
| `direction`    | number                                                       | `spot`/`wash`: aim (0=right, 90=down, 180=left, 270=up). |
| `penumbra`     | number                                                       | `spot`/`wash`: edge softness 0 (hard) – 1 (soft).        |

Make a particle emit light with `"light": true` on its `particles` entry.

