// Recolour the raw scrapbook sticker SVGs onto one shared palette.
//
// Usage: node scripts/sticker-recolor/recolor.mjs <raw-dir> [out-dir]
//
// - Reads every *.svg in <raw-dir>.
// - Learns a shared palette from the actual sticker colours (k-means in OKLab)
//   and snaps each colour to a distinct swatch, keeping hue and vividness.
// - Applies a few hand-picked object colourways (camera, vans, controller, ...).
// - Writes recoloured SVGs + sidecar JSON (kind: "sticker", colour slots) into
//   <out-dir> (default: src/assets/svg) and a tracking manifest next to this
//   script.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, FAMILY_LABELS, OPTION_COLORS } from './palette.mjs';
import { MATERIALS, FAMILY_MATERIAL, SLOT_PLAN } from './slots.mjs';
import { OVERRIDES } from './overrides.mjs';
import { hexToRgb, rgbToOklab, oklabToRgb, rgbToHex, hexToOklch, lerpOklch } from './colorutil.mjs';

/** Match 3- or 6-digit hex; normalise 3-digit to 6 so nothing stays literal. */
const HEX_RE = /#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
function normHex(h) {
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const SRC = process.argv[2] ? resolve(process.argv[2]) : resolve(repoRoot, 'stickers-raw');
const OUT = process.argv[3] ? resolve(process.argv[3]) : resolve(repoRoot, 'src/assets/svg');
const MANIFEST = join(scriptDir, 'manifest.json');

// Stickers kept exactly as sourced (colours untouched).
const KEEP_ORIGINAL = new Set([
  'conch-shell.svg',
  'pinecone.svg',
  'pumpkin.svg',
  'picnic-basket.svg',
  'compass.svg',
  'compass-rose.svg',
  'armchair.svg',
  'acorn.svg',
  'hearts.svg',
  'keys.svg',
  'love-letter.svg',
  'passport.svg',
  'pepperoni-pizza.svg',
  'shipping-tag.svg',
  'folded-map.svg',
]);

// Object fixes that stood out as wrong in the source art.
const OBJECT_FIXES = [
  'camera.svg',
  'camper-van.svg',
  'minivan.svg',
  'controller.svg',
  'arcade-joystick.svg',
  'airplane.svg',
];

// Files whose names collide with existing assets are namespaced.
const RENAME = {
  'camera.svg': 'sticker-camera.svg',
  'scallop-shell.svg': 'sticker-scallop-shell.svg',
  'washi-tape.svg': 'sticker-washi-tape.svg',
  'heart.svg': 'sticker-heart.svg',
};
const outName = (f) => RENAME[f] ?? f;
const LABELS = {
  'sticker-camera': 'Camera',
  'sticker-scallop-shell': 'Scallop shell',
  'sticker-washi-tape': 'Washi tape',
  'sticker-heart': 'Heart',
};
const labelOf = (id) =>
  LABELS[id] ??
  id
    .replace(/\.svg$/, '')
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');

const files = readdirSync(SRC)
  .filter((f) => f.endsWith('.svg'))
  .sort();
const fileColors = new Map();
const weight = new Map();
for (const f of files) {
  const raw = readFileSync(join(SRC, f), 'utf8');
  const uniq = [...new Set([...raw.matchAll(HEX_RE)].map((m) => normHex(m[0]).toUpperCase()))];
  fileColors.set(f, { raw, uniq });
  for (const c of uniq) weight.set(c, (weight.get(c) ?? 0) + 1);
}

// ---- Learn a shared palette from the actual sticker colours (k-means OKLab).
const colors = [...weight.keys()];
const cmap = new Map(colors.map((c) => [c, rgbToOklab(hexToRgb(c))]));
const labOf = (c) => {
  if (!cmap.has(c)) cmap.set(c, rgbToOklab(hexToRgb(c)));
  return cmap.get(c);
};
const K = 56;
let centers = [colors[0]];
while (centers.length < K) {
  let best = colors[0],
    bestD = -1;
  for (const c of colors) {
    let d = Infinity;
    for (const cc of centers) {
      const A = labOf(c),
        B = labOf(cc);
      d = Math.min(d, (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2);
    }
    const d2 = d * (weight.get(c) ?? 1);
    if (d2 > bestD) {
      bestD = d2;
      best = c;
    }
  }
  centers.push(best);
}
for (let iter = 0; iter < 60; iter++) {
  const sum = Array.from({ length: K }, () => [0, 0, 0, 0]);
  for (const c of colors) {
    let bi = 0,
      bd = Infinity;
    for (let i = 0; i < K; i++) {
      const A = labOf(c),
        B = labOf(centers[i]);
      const d = (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const w = weight.get(c) ?? 1,
      A = labOf(c);
    sum[bi][0] += A[0] * w;
    sum[bi][1] += A[1] * w;
    sum[bi][2] += A[2] * w;
    sum[bi][3] += w;
  }
  centers = sum.map((s, i) =>
    s[3] ? rgbToHex(oklabToRgb([s[0] / s[3], s[1] / s[3], s[2] / s[3]])) : centers[i],
  );
}
centers = [...new Set(centers)];
const clabs = centers.map((c) => labOf(c));
const distLab = (A, B) => (A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (A[2] - B[2]) ** 2;
const hueOf = (l) => (Math.atan2(l[2], l[1]) * 180) / Math.PI;
const chromaOf = (l) => Math.hypot(l[1], l[2]);
const hueDiff = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const centerHue = clabs.map(hueOf);
const centerChroma = clabs.map(chromaOf);

/** Snap a file's colours to distinct palette swatches, staying near each hue. */
function snap(uniq, reservedHex) {
  const WIN = 48,
    CMIN = 0.045;
  const pairs = [];
  uniq.forEach((c, i) => {
    const A = labOf(c),
      h = hueOf(A),
      chrom = chromaOf(A);
    let js = centers.map((_, j) => j);
    if (chrom > CMIN) {
      const filt = js.filter((j) => centerChroma[j] > 0.03 && hueDiff(h, centerHue[j]) <= WIN);
      if (filt.length) js = filt;
    }
    for (const j of js) pairs.push({ i, j, d: distLab(A, clabs[j]) });
  });
  pairs.sort((a, b) => a.d - b.d);
  const usedSrc = new Set(),
    usedDst = new Set();
  const map = new Map();
  for (const p of pairs) {
    if (usedSrc.has(p.i)) continue;
    const t = centers[p.j];
    if (usedDst.has(t) || reservedHex.has(t)) continue;
    usedSrc.add(p.i);
    usedDst.add(t);
    map.set(uniq[p.i], t);
  }
  for (let i = 0; i < uniq.length; i++) {
    if (usedSrc.has(i)) continue;
    let bt = null,
      bd = Infinity;
    centers.forEach((t, j) => {
      if (usedDst.has(t) || reservedHex.has(t)) return;
      const d = distLab(labOf(uniq[i]), clabs[j]);
      if (d < bd) {
        bd = d;
        bt = t;
      }
    });
    if (bt) {
      usedSrc.add(i);
      usedDst.add(bt);
      map.set(uniq[i], bt);
    }
  }
  return map;
}

// ---- Curated families are reused only for grouping/labelling linked shades.
const ramps = Object.fromEntries(Object.entries(FAMILIES).map(([n, l]) => [n, l.map(hexToOklch)]));
function nearestFamily(hex) {
  const A = hexToOklch(hex);
  const ax = A.C * Math.cos((A.h * Math.PI) / 180),
    ay = A.C * Math.sin((A.h * Math.PI) / 180);
  let best = 'stone',
    bestD = Infinity;
  for (const [name, r] of Object.entries(ramps))
    for (const c of r) {
      const bx = c.C * Math.cos((c.h * Math.PI) / 180),
        by = c.C * Math.sin((c.h * Math.PI) / 180);
      const d = (A.L - c.L) ** 2 * 1.4 + (ax - bx) ** 2 + (ay - by) ** 2;
      if (d < bestD) {
        bestD = d;
        best = name;
      }
    }
  return best;
}
function rampMidL(name) {
  const r = ramps[name];
  const x = 0.5 * (r.length - 1),
    i = Math.min(r.length - 2, Math.floor(x));
  return lerpOklch(r[i], r[i + 1], x - i).L;
}
/** Build this sticker's slots from its curation plan, merging families as asked. */
function buildSlots(f, entries, counts) {
  const byTarget = new Map(entries.map((e) => [e.target, e.group]));
  const used = new Set();
  const slots = [];
  const make = (spec, targets) => {
    const uniqT = [...new Set(targets)];
    if (!uniqT.length) return;
    // Base = the colour covering the most artwork (occurrence count), so linked
    // shades derive from the sticker's dominant colour.
    let base = uniqT[0],
      best = -1;
    for (const c of uniqT) {
      const n = counts.get(c) ?? 0;
      if (n > best) {
        best = n;
        base = c;
      }
    }
    const baseL = hexToOklch(base).L;
    const material = MATERIALS[spec.material] ?? OPTION_COLORS;
    slots.push({
      id: spec.id,
      label: spec.label,
      default: base,
      palette: [base, ...material.filter((c) => c.toUpperCase() !== base.toUpperCase())],
      allowCustom: true,
      shades: uniqT
        .filter((c) => c !== base)
        .map((c) => ({ color: c, deltaL: Number((hexToOklch(c).L - baseL).toFixed(4)) }))
        .sort((a, b) => b.deltaL - a.deltaL),
    });
  };

  const plan = SLOT_PLAN[f];
  if (plan) {
    for (const spec of plan) {
      const targets = [...byTarget.keys()].filter(
        (t) => !used.has(t) && spec.families.includes(byTarget.get(t)),
      );
      targets.forEach((t) => used.add(t));
      make(spec, targets);
    }
    const leftover = [...byTarget.keys()].filter((t) => !used.has(t));
    if (leftover.length) {
      const fams = [...new Set(leftover.map((t) => byTarget.get(t)))];
      console.warn(`  ! ${f}: unplanned colours (${fams.join(', ')}) -> Accent slot`);
      make({ id: 'accent', label: 'Accent', material: 'neutral' }, leftover);
    }
  } else {
    const byFam = new Map();
    for (const e of entries) {
      if (!byFam.has(e.group)) byFam.set(e.group, []);
      byFam.get(e.group).push(e.target);
    }
    for (const [fam, targets] of byFam) {
      make(
        { id: fam, label: FAMILY_LABELS[fam], material: FAMILY_MATERIAL[fam] ?? 'neutral' },
        targets,
      );
    }
  }
  return slots;
}
function aspectOf(raw) {
  const vb = /viewBox\s*=\s*["']([^"']+)["']/.exec(raw);
  if (vb) {
    const p = vb[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (p.length === 4 && p[2] > 0 && p[3] > 0) return Number((p[2] / p[3]).toFixed(4));
  }
  return 1;
}

mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const f of files) {
  const { raw, uniq } = fileColors.get(f);
  const strip = (s) => s.replace(/<!-- SVG created with Arrow.*?-->\s*/i, '');
  const ov = OBJECT_FIXES.includes(f) ? OVERRIDES[f] : null;

  // Original hex -> resolved target hex (kept original when told to).
  const targetOf = new Map();
  if (KEEP_ORIGINAL.has(f)) {
    for (const c of uniq) targetOf.set(c, c);
  } else {
    const reserved = new Set(ov ? Object.values(ov) : []);
    const autoUniq = uniq.filter((c) => !ov || !(c in ov));
    const snapMap = snap(autoUniq, reserved);
    for (const c of uniq) targetOf.set(c, ov && c in ov ? ov[c] : (snapMap.get(c) ?? c));
  }

  const isOverride = (c) => !KEEP_ORIGINAL.has(f) && !!ov && c in ov;
  const entries = uniq.map((c) => ({
    target: targetOf.get(c),
    group: nearestFamily(isOverride(c) ? targetOf.get(c) : c),
  }));

  const counts = new Map();
  for (const m of raw.matchAll(HEX_RE)) {
    const t = targetOf.get(normHex(m[0]).toUpperCase()) ?? normHex(m[0]).toUpperCase();
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const slots = buildSlots(f, entries, counts);

  // Every slot is driven by one CSS variable; its linked shades derive from the
  // chosen colour via relative-colour syntax, which preserves hue/chroma and
  // applies the shade's original lightness offset. Base colours stay exact.
  const exprOf = new Map();
  for (const slot of slots) {
    const v = `var(--c-${slot.id}, ${slot.default})`;
    exprOf.set(slot.default.toUpperCase(), v);
    for (const sh of slot.shades) {
      const sign = sh.deltaL >= 0 ? '+' : '-';
      exprOf.set(
        sh.color.toUpperCase(),
        `oklch(from ${v} calc(l ${sign} ${Math.abs(sh.deltaL)}) c h)`,
      );
    }
  }

  const out = strip(raw).replace(HEX_RE, (m) => {
    const t = targetOf.get(normHex(m).toUpperCase());
    return (t && exprOf.get(t)) ?? m;
  });
  const name = outName(f);
  writeFileSync(join(OUT, name), out);
  const id = name.replace(/\.svg$/, '');
  writeFileSync(
    join(OUT, id + '.json'),
    JSON.stringify(
      { kind: 'sticker', label: labelOf(id), aspect: aspectOf(raw), colorSlots: slots },
      null,
      2,
    ) + '\n',
  );
  manifest[id] = {
    source: f,
    slots,
    colors: Object.fromEntries(uniq.map((c) => [c, targetOf.get(c)])),
  };
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Recoloured ${files.length} stickers -> ${OUT} (palette ${centers.length} swatches).`);
