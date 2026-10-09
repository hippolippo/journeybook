# Journeybook — design mockups

Standalone, no-build HTML/CSS/JS mockups for the first design slice. No
dependencies to install.

## Viewing

Open `design/index.html` directly in a browser, or serve the folder:

```sh
python3 -m http.server 4321 --directory design
# then open http://localhost:4321/
```

A small screen-switcher pill at the bottom jumps between views.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Navigable prototype: Home → Organizer → Interior |
| `home.html` | Isolated Home screen |
| `scrapbook.html` | Isolated organizer (root) |
| `folder.html` | Isolated organizer opened on a nested folder |
| `interior.html` | Isolated scrapbook interior |
| `styles.css` | Design system (tokens + components) |
| `app.js` | Vanilla renderer + interactions |
| `mock-data.js` | Seed folders/scrapbooks/pages |
| `assets/svg/` | All art, one file per asset |
| `SPEC.md` | The written spec |

## This is a mockup

- State is in-memory only — refreshing resets everything.
- Rename/Delete use native `prompt`/`confirm`; a real TBD UI comes later.
- Fonts load from Google Fonts via CDN.
- The design tokens in `styles.css` are intended to port directly into the Vue
  app once we scaffold it.
