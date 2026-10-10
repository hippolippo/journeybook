# Palettes & preset schemes

The scaffold assigns every slot the shared Journeybook palette (mirrors
`src/catalog/catalog.ts`) and, for two or more slots, generates one preset per
named scheme below.

## Shared palette

```
#d98c8c  #e8b4af  #c97b5a  #d9a94e  #9caf88  #7e8f6b
#9dbfc9  #d3b184  #b99362  #fcf7ec  #4a3b2e
```

Reds and pinks → warm browns → greens → sky/blue → wood/tan → paper white →
ink `#4a3b2e`. Use it as quick-swatch choices under each slot; `allowCustom:
true` still gives the free colour picker.

## Named preset schemes

Each scheme is a ramp; slot `i` takes `ramp[i % ramp.length]`. This gives a
coherent whole-item look in one click. Adjust per asset when the ramp lands
badly on a particular slot (e.g. don't let a pot turn green).

| Preset id | Label | Ramp                                    |
| --------- | ----- | --------------------------------------- |
| `blush`   | Blush | `#e8b4af` `#d98c8c` `#f7c9c9` `#c97b5a` |
| `sage`    | Sage  | `#9caf88` `#7e8f6b` `#cfe3c5` `#e8d9c0` |
| `honey`   | Honey | `#f6e8a8` `#d9a94e` `#d3b184` `#b99362` |
| `sky`     | Sky   | `#9dbfc9` `#cfe0ea` `#fcf7ec` `#7e8f6b` |
| `cocoa`   | Cocoa | `#4a3b2e` `#b99362` `#d3b184` `#fcf7ec` |

Example for slots `leaves` + `pot`:

```json
"presets": [
  { "id": "sage",  "label": "Sage",  "colors": { "leaves": "#9caf88", "pot": "#7e8f6b" } },
  { "id": "honey", "label": "Honey", "colors": { "leaves": "#f6e8a8", "pot": "#d9a94e" } }
]
```

## When not to add presets

- A single slot already exposes the palette; presets add noise — leave them out
  (`--presets none`).
- If the user only wants per-slot swatches, skip presets.

Prefer hand-named presets that read like a look ("Amber", "Midnight", "Candy")
when the generated scheme labels don't fit the asset.
