// Crop each sticker's viewBox to its actual artwork bounds so the element's
// hitbox / resize box hugs the SVG edges, and update the sidecar aspect.
//
// Usage: node scripts/sticker-recolor/tighten.mjs [svg-dir]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit } from '@playwright/test';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const DIR = resolve(process.argv[2] ?? join(repoRoot, 'src/assets/svg'));
const manifest = JSON.parse(readFileSync(join(scriptDir, 'manifest.json'), 'utf8'));
const ids = Object.keys(manifest);

const browser = await webkit.launch();
const page = await browser.newPage();
let changed = 0;
for (const id of ids) {
  const file = join(DIR, `${id}.svg`);
  const svg = readFileSync(file, 'utf8');
  await page.setContent(`<!doctype html><body style="margin:0">${svg}</body>`);
  const box = await page.evaluate(() => {
    const el = document.querySelector('svg');
    if (!el) return null;
    const b = el.getBBox();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });
  if (!box || !(box.w > 0) || !(box.h > 0)) {
    console.warn(`  ! ${id}: no measurable bbox, skipped`);
    continue;
  }
  // Keep a hair of padding so anti-aliased strokes aren't clipped.
  const pad = Math.max(1, 0.02 * Math.max(box.w, box.h));
  const x = +(box.x - pad).toFixed(2);
  const y = +(box.y - pad).toFixed(2);
  const w = +(box.w + pad * 2).toFixed(2);
  const h = +(box.h + pad * 2).toFixed(2);
  const out = svg
    .replace(/viewBox="[^"]*"/, `viewBox="${x} ${y} ${w} ${h}"`)
    .replace(/\swidth="[^"]*"/, ` width="${w}"`)
    .replace(/\sheight="[^"]*"/, ` height="${h}"`);
  if (out === svg) {
    console.warn(`  ! ${id}: no viewBox/width/height to rewrite`);
    continue;
  }
  writeFileSync(file, out);
  const sidecarPath = join(DIR, `${id}.json`);
  const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8'));
  sidecar.aspect = +(w / h).toFixed(4);
  writeFileSync(sidecarPath, JSON.stringify(sidecar, null, 2) + '\n');
  changed++;
}
await browser.close();
console.log(`Tightened ${changed}/${ids.length} stickers.`);
