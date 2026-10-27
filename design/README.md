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
| `notes.html` | **Notes mockup**: Home → Notes shelf → letter composer → envelope → reading view |
| `styles.css` | Design system (tokens + components) |
| `app.js` | Vanilla renderer + interactions |
| `mock-data.js` | Seed folders/scrapbooks/pages |
| `notes.css` / `notes.js` / `notes-data.js` | Notes mockup styles, renderer and seed letters |
| `assets/svg/` | All art, one file per asset |

Behaviour is specified in [`../SPEC.md`](../SPEC.md). These mockups are visual
reference only.

## Notes mockup

Open `notes.html` (or the "Notes (new)" link in the screen switcher). It is
self-contained and mirrors the shipped app shell (room, room bar, side panel)
rather than the older design prototype.

Try this flow:

1. The home shelf has a second object: **Notes**, styled as a matching cover and
   showing the unread count.
2. Open **Notes**. Use the mock dock at the bottom to switch between **Wren**
   and **Finn**. Each account has its own drafts and inbox/outbox.
3. **New letter**: choose paper, set the page height (drag the bottom edge of
   the paper), select text and use the font, size, ink,
   highlight, bold/italic/underline/strike and alignment controls. Text that
   runs past the page continues below the paper in red.
4. Switch to **Envelope** to change the tint, wax-seal colour and initial, and
   the stamp. **Seal & send** opens a confirmation and shows the mock email
   notification card.
5. As the other partner, open the sealed letter and **Break the seal** — the flap
   opens first, then the envelope slides down, and the letter stays in place. As
   the author, the letter is now locked (no Edit or Pull back).
6. Before it is opened you can still **Edit** or **Pull back** a sent letter.
   Drafts autosave and live under **Drafts**.

Mock-only behaviour: state lives in `sessionStorage` (a refresh keeps it; **Reset**
in the mock dock restores the seeded letters), and email is a visual preview —
nothing is sent. Advanced note features (stickers, photos, multiple text boxes)
are intentionally not part of this mockup.

## This is a mockup

- The older screens (`index`, `home`, `scrapbook`, `folder`, `interior`) keep
  state in memory only — refreshing resets them.
- The Notes mockup uses `sessionStorage`, so a refresh keeps drafts; **Reset**
  restores the seeded letters.
- Email is a visual preview only. Nothing is sent.
- Rename/Delete use native `prompt`/`confirm`; a real TBD UI comes later.
- Fonts load from Google Fonts via CDN.
- The design tokens are intended to port directly into the Vue app once we
  scaffold it.
