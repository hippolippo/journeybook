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
| `art`             | `{ day, night }`                | Optional; a lone day SVG auto-detects `<id>-night.svg`. |
| `colorSlots`      | array                           | One per `var(--c-<id>, …)` in the art.                  |
| `presets`         | array                           | Named multi-slot colour combos.                         |
| `effect`          | object \| array                 | Shortcut motion recipes (§7.2 of the guide).            |
| `animations`      | array                           | Data-defined whole-object animation.                    |
| `particles`       | array                           | Data-defined particle systems.                          |
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
    "day": "trailing-plant.svg",
    "night": {
      "src": "trailing-plant.svg",
      "particles": [ { "name": "firefly", "count": 5, "duration": 5 } ]
    }
  }
  ```

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
