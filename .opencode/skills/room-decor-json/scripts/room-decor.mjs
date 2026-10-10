#!/usr/bin/env node
// Journeybook room-decoration JSON assistant (zero dependencies, plain Node ESM).
//
// Commands:
//   inspect  <svg> [--night <svg>]                     Report viewBox/aspect + recolor slots.
//   scaffold --svg <svg> [--night <svg>] [options]     Emit a draft sidecar definition.
//   check    <json> [--svg-dir <dir>]                  Validate a sidecar against the SVGs.
//
// Run `node room-decor.mjs help` for all options.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CATEGORIES = ['wallpaper', 'flooring', 'furniture', 'wallDecor', 'trinket', 'pet'];
const LAYERS = ['wall', 'floor', 'surface'];
const BANDS = ['wall', 'floor', 'both'];
const ATTACH = ['furniture', 'shelf', 'any'];
const REPEATS = ['x', 'y', 'both'];
const EFFECT_TYPES = ['sway', 'glow', 'smoke', 'float', 'flicker', 'twinkle'];

/** Shared Journeybook palette (mirrors src/catalog/catalog.ts). */
const PALETTE = [
  '#d98c8c',
  '#e8b4af',
  '#c97b5a',
  '#d9a94e',
  '#9caf88',
  '#7e8f6b',
  '#9dbfc9',
  '#d3b184',
  '#b99362',
  '#fcf7ec',
  '#4a3b2e',
];

/** Named multi-slot looks; slot i takes ramp[i % ramp.length]. */
const SCHEMES = [
  { id: 'blush', label: 'Blush', ramp: ['#e8b4af', '#d98c8c', '#f7c9c9', '#c97b5a'] },
  { id: 'sage', label: 'Sage', ramp: ['#9caf88', '#7e8f6b', '#cfe3c5', '#e8d9c0'] },
  { id: 'honey', label: 'Honey', ramp: ['#f6e8a8', '#d9a94e', '#d3b184', '#b99362'] },
  { id: 'sky', label: 'Sky', ramp: ['#9dbfc9', '#cfe0ea', '#fcf7ec', '#7e8f6b'] },
  { id: 'cocoa', label: 'Cocoa', ramp: ['#4a3b2e', '#b99362', '#d3b184', '#fcf7ec'] },
];

/** Starting placement/size per category; always overridable with flags. */
const CATEGORY_DEFAULTS = {
  wallpaper: { layer: 'wall', band: 'wall', scale: 1 },
  flooring: { layer: 'floor', band: 'floor', scale: 0.5 },
  furniture: { layer: 'floor', band: 'floor', scale: 0.6 },
  wallDecor: { layer: 'wall', band: 'wall', scale: 0.3 },
  trinket: { layer: 'surface', band: 'floor', scale: 0.18 },
  pet: { layer: 'surface', band: 'floor', scale: 0.4 },
};

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function fail(message) {
  throw new Error(message);
}

function round(n, digits = 3) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function assertEnum(name, value, allowed) {
  if (!allowed.includes(value))
    fail(`--${name} must be one of: ${allowed.join(', ')} (got "${value}")`);
}

function readText(path) {
  if (!existsSync(path)) fail(`file not found: ${path}`);
  return readFileSync(path, 'utf8');
}

function readJson(path) {
  const text = readText(path);
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`invalid JSON in ${path}: ${error.message}`);
  }
}

function parseViewBox(svg) {
  const match = /viewbox\s*=\s*["']([^"']+)["']/i.exec(svg);
  if (!match) return null;
  const parts = match[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts;
  if (width === 0 || height === 0) return { x, y, width, height, aspect: 1 };
  return { x, y, width, height, aspect: width / height };
}

/**
 * Find `var(--c-<id>[, <fallback>])` custom-property usages. The fallback is
 * captured with balanced parentheses so `rgba(…)` fallbacks survive intact.
 */
function extractSlots(svg) {
  const found = new Map();
  const re = /var\(\s*--c-([a-zA-Z0-9-]+)/g;
  let match;
  while ((match = re.exec(svg))) {
    const id = match[1];
    let i = re.lastIndex;
    while (i < svg.length && /\s/.test(svg[i])) i++;
    let fallback = null;
    if (svg[i] === ',') {
      i++;
      const start = i;
      let depth = 0;
      for (; i < svg.length; i++) {
        const ch = svg[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          if (depth === 0) break;
          depth--;
        }
      }
      fallback = svg.slice(start, i).trim();
    }
    if (!found.has(id) || (found.get(id) == null && fallback)) found.set(id, fallback);
  }
  return found;
}

function collectSlots(variants) {
  const map = new Map();
  for (const [variant, raw] of variants) {
    if (!raw) continue;
    for (const [id, fallback] of extractSlots(raw)) {
      const entry = map.get(id) ?? { id, default: null, variants: [] };
      if (!entry.variants.includes(variant)) entry.variants.push(variant);
      if (entry.default == null && fallback) entry.default = fallback;
      map.set(id, entry);
    }
  }
  return [...map.values()];
}

function idFromSvgPath(svgPath) {
  return basename(svgPath)
    .replace(/\.svg$/i, '')
    .replace(/-night$/i, '');
}

function titleFromId(id) {
  const words = id.split(/[-_]+/).filter(Boolean);
  if (words.length === 0) return id;
  return [
    words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase(),
    ...words.slice(1).map((w) => w.toLowerCase()),
  ].join(' ');
}

function isExternalRef(ref) {
  return /^(?:data:|https?:|blob:)/i.test(ref);
}

function artSrc(value) {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : value.src;
}

function normalizeColor(value) {
  return String(value).replace(/\s+/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(args, booleanFlags = []) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') {
      out._.push(...args.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (booleanFlags.includes(key)) {
        out[key] = true;
        continue;
      }
      const value = args[++i];
      if (value === undefined) fail(`missing value for --${key}`);
      out[key] = value;
    } else if (arg.startsWith('-') && arg !== '-') {
      out[arg.slice(1)] = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// inspect
// ---------------------------------------------------------------------------

function cmdInspect(args) {
  const flags = parseArgs(args, ['json']);
  const svgPath = flags._[0];
  if (!svgPath) fail('inspect requires an SVG path: inspect <svg>');
  const dayRaw = readText(svgPath);
  const nightPath = flags.night;
  const nightRaw = nightPath ? readText(nightPath) : undefined;
  const dayBox = parseViewBox(dayRaw);
  const id = idFromSvgPath(svgPath);
  const slots = collectSlots([
    ['day', dayRaw],
    ['night', nightRaw],
  ]);

  const result = {
    id,
    svg: basename(svgPath),
    ...(nightPath ? { night: basename(nightPath) } : {}),
    viewBox: dayBox,
    aspect: dayBox ? round(dayBox.aspect) : null,
    ...(nightRaw ? { nightViewBox: parseViewBox(nightRaw) } : {}),
    slots,
  };

  if (flags.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return 0;
  }

  console.log(`id:     ${id}`);
  console.log(`art:    ${basename(svgPath)}${nightPath ? ` + ${basename(nightPath)}` : ''}`);
  if (dayBox)
    console.log(`viewBox: ${dayBox.width} × ${dayBox.height}  →  aspect ${round(dayBox.aspect)}`);
  else console.log('viewBox: (none found — the SVG needs a viewBox and no fixed width/height)');
  if (slots.length === 0) {
    console.log('slots:  none (no var(--c-…) usages found — this art renders as-is)');
  } else {
    console.log(`slots:  ${slots.length}`);
    for (const slot of slots) {
      console.log(
        `  - ${slot.id}  default ${slot.default ?? '(unset)'}  [${slot.variants.join(', ')}]`,
      );
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// scaffold
// ---------------------------------------------------------------------------

function buildPresets(slots) {
  return SCHEMES.map((scheme) => ({
    id: scheme.id,
    label: scheme.label,
    colors: Object.fromEntries(
      slots.map((slot, i) => [slot.id, scheme.ramp[i % scheme.ramp.length]]),
    ),
  }));
}

function mergeMotion(target, fragment, where) {
  if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment))
    fail(`${where} must be a JSON object`);
  for (const key of ['effect', 'animations', 'particles']) {
    if (fragment[key] !== undefined) target[key] = fragment[key];
  }
  const extra = Object.keys(fragment).filter(
    (k) => !['effect', 'animations', 'particles'].includes(k),
  );
  if (extra.length)
    console.error(`room-decor: ignoring unknown ${where} keys: ${extra.join(', ')}`);
}

function cmdScaffold(args) {
  const flags = parseArgs(args, ['json', 'host']);
  const svgPath = flags.svg ?? flags._[0];
  if (!svgPath) fail('scaffold requires --svg <path>');

  const dayRaw = readText(svgPath);
  const box = parseViewBox(dayRaw);
  if (!box) fail(`no viewBox found in ${svgPath} (add one and remove fixed width/height)`);
  const id = idFromSvgPath(svgPath);
  const nightPath = flags.night;
  const nightRaw = nightPath ? readText(nightPath) : undefined;

  const category = flags.category ?? 'trinket';
  assertEnum('category', category, CATEGORIES);
  const defaults = CATEGORY_DEFAULTS[category];
  const layer = flags.layer ?? defaults.layer;
  assertEnum('layer', layer, LAYERS);
  const band = flags.band ?? defaults.band;
  assertEnum('band', band, BANDS);
  const scale = flags.scale !== undefined ? Number(flags.scale) : defaults.scale;
  if (!Number.isFinite(scale)) fail('--scale must be a number');

  const def = {
    kind: 'room',
    label: flags.label ?? titleFromId(id),
    category,
    layer,
    band,
    aspect: round(box.aspect),
    defaultScale: scale,
  };

  if (flags.rotation !== undefined) {
    const rotation = Number(flags.rotation);
    if (!Number.isFinite(rotation)) fail('--rotation must be a number');
    def.defaultRotation = rotation;
  }

  if (layer === 'surface') {
    const attach = flags.attach ?? 'furniture';
    assertEnum('attach', attach, ATTACH);
    def.attach = attach;
  } else if (flags.attach !== undefined) {
    fail('--attach only applies to surface items (layer: "surface")');
  }

  if (flags.host) {
    if (layer === 'surface')
      fail('a surface item cannot be a host (only wall/floor furniture or shelves can)');
    def.host = true;
  }

  if (flags.repeat !== undefined) {
    assertEnum('repeat', flags.repeat, REPEATS);
    def.repeat = flags.repeat;
  }

  if (flags.motion !== undefined) mergeMotion(def, readJson(flags.motion), '--motion');

  // Art (only write it when a night variant is supplied; a lone day SVG auto-detects).
  if (nightPath) {
    const night = { src: basename(nightPath) };
    if (flags['night-motion'] !== undefined)
      mergeMotion(night, readJson(flags['night-motion']), '--night-motion');
    def.art = { day: basename(svgPath), night };
  }

  const slots = collectSlots([
    ['day', dayRaw],
    ['night', nightRaw],
  ]);
  if (slots.length > 0) {
    def.colorSlots = slots.map((slot) => ({
      id: slot.id,
      label: titleFromId(slot.id),
      default: slot.default ?? '#000000',
      palette: PALETTE,
      allowCustom: true,
    }));
    if ((flags.presets ?? 'auto') !== 'none' && slots.length >= 2)
      def.presets = buildPresets(slots);
  }

  const json = JSON.stringify(def, null, 2) + '\n';
  if (flags.out !== undefined) {
    writeFileSync(flags.out, json);
    if (!flags.json) console.error(`wrote ${flags.out}`);
  } else {
    process.stdout.write(json);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

function resolveRef(dir, ref) {
  if (isExternalRef(ref)) return null;
  return ref.includes('/') || ref.includes('\\') ? resolve(dir, ref) : join(dir, ref);
}

function availabilityOf(raws) {
  const ids = new Set();
  const fallbacks = new Map();
  for (const raw of raws) {
    if (!raw) continue;
    for (const [id, fallback] of extractSlots(raw)) {
      ids.add(id);
      if (!fallbacks.has(id) && fallback) fallbacks.set(id, fallback);
    }
  }
  return { ids, fallbacks };
}

function checkMotion(def, log, label) {
  const { effect, animations, particles } = def;

  if (effect !== undefined && effect !== null) {
    const list = Array.isArray(effect) ? effect : [effect];
    list.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object')
        log.err(`${label} effect #${i + 1} must be an object`);
      else if (!EFFECT_TYPES.includes(entry.type))
        log.err(`${label} effect #${i + 1} has unknown type "${entry.type}"`);
    });
  }

  if (animations !== undefined) {
    if (!Array.isArray(animations)) log.err(`${label} "animations" must be an array`);
    else
      animations.forEach((animation, i) => {
        if (!animation || typeof animation !== 'object')
          log.err(`${label} animation #${i + 1} must be an object`);
        else if (!Array.isArray(animation.keyframes) || animation.keyframes.length === 0)
          log.err(
            `${label} animation "${animation.name ?? i + 1}" needs a non-empty "keyframes" array`,
          );
      });
  }

  if (particles !== undefined) {
    if (!Array.isArray(particles)) log.err(`${label} "particles" must be an array`);
    else
      particles.forEach((particle, i) => {
        const name = particle?.name ?? i + 1;
        if (!particle || typeof particle !== 'object') {
          log.err(`${label} particle #${name} must be an object`);
          return;
        }
        if (
          particle.count !== undefined &&
          (typeof particle.count !== 'number' || particle.count < 1 || particle.count > 24)
        )
          log.warn(`${label} particle "${name}" count should be between 1 and 24`);
        if (
          particle.shape !== undefined &&
          (typeof particle.shape !== 'object' || Array.isArray(particle.shape))
        )
          log.err(`${label} particle "${name}" "shape" must be an object`);
        if (particle.shape?.svg && typeof particle.shape.svg !== 'string')
          log.err(`${label} particle "${name}" shape.svg must be a string`);
        if (
          particle.motion !== undefined &&
          (!particle.motion || !Array.isArray(particle.motion.keyframes))
        )
          log.err(`${label} particle "${name}" "motion" needs a "keyframes" array`);
      });
  }
}

function checkEntry(def, ctx) {
  const errors = [];
  const warnings = [];
  const infos = [];
  const log = {
    err: (m) => errors.push(m),
    warn: (m) => warnings.push(m),
    info: (m) => infos.push(m),
  };

  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    errors.push('definition must be an object');
    return { id: '?', errors, warnings, infos };
  }

  const artDay = artSrc(def.art?.day);
  const id =
    typeof def.id === 'string' && def.id
      ? def.id
      : (artDay?.replace(/\.svg$/i, '') ?? basename(ctx.jsonPath, '.json'));

  if ((def.kind ?? 'room') !== 'room')
    errors.push(`kind must be "room" for a room decoration (got "${def.kind}")`);

  // Placement
  if (def.category === undefined) warnings.push('missing "category" (defaults to "trinket")');
  else if (!CATEGORIES.includes(def.category)) errors.push(`invalid category "${def.category}"`);
  if (def.layer === undefined) warnings.push('missing "layer" (defaults to "surface")');
  else if (!LAYERS.includes(def.layer)) errors.push(`invalid layer "${def.layer}"`);
  if (def.band === undefined) warnings.push('missing "band" (defaults to "floor")');
  else if (!BANDS.includes(def.band)) errors.push(`invalid band "${def.band}"`);

  if (def.layer === 'surface') {
    if (def.attach === undefined) infos.push('surface item with no "attach" (defaults to "any")');
    else if (!ATTACH.includes(def.attach)) errors.push(`invalid attach "${def.attach}"`);
    if (def.host === true) errors.push('a surface item cannot set "host": true');
  } else {
    if (def.attach !== undefined) warnings.push('"attach" only applies to surface items');
    if (def.host !== undefined && typeof def.host !== 'boolean')
      errors.push('"host" must be a boolean');
    else if (def.host === true) infos.push('host: true — this item can hold surface items');
  }
  if (def.repeat !== undefined && !REPEATS.includes(def.repeat))
    errors.push(`invalid repeat "${def.repeat}"`);

  // Art files
  const dayRef = artDay ?? `${id}.svg`;
  const nightRef =
    artSrc(def.art?.night) ??
    (existsSync(join(ctx.svgDir, `${id}-night.svg`)) ? `${id}-night.svg` : undefined);

  const dayPath = resolveRef(ctx.svgDir, dayRef);
  const dayRaw = dayPath && existsSync(dayPath) ? readFileSync(dayPath, 'utf8') : undefined;
  if (!dayRaw && !isExternalRef(dayRef))
    errors.push(`day art not found: ${dayRef} (looked in ${ctx.svgDir})`);

  let nightRaw;
  if (nightRef && !isExternalRef(nightRef)) {
    const nightPath = resolveRef(ctx.svgDir, nightRef);
    nightRaw = nightPath && existsSync(nightPath) ? readFileSync(nightPath, 'utf8') : undefined;
    if (!nightRaw) errors.push(`night art not found: ${nightRef}`);
  }

  // Aspect
  if (def.aspect === undefined) {
    warnings.push('missing "aspect" (derive it from the SVG viewBox)');
  } else if (typeof def.aspect !== 'number' || !(def.aspect > 0)) {
    errors.push('"aspect" must be a positive number');
  } else if (dayRaw) {
    const box = parseViewBox(dayRaw);
    if (box && Math.abs(box.aspect - def.aspect) > 0.02)
      warnings.push(
        `aspect ${def.aspect} differs from the viewBox ratio (${round(box.aspect)} suggested)`,
      );
  }
  if (nightRaw && dayRaw) {
    const dayBox = parseViewBox(dayRaw);
    const nightBox = parseViewBox(nightRaw);
    if (dayBox && nightBox && Math.abs(dayBox.aspect - nightBox.aspect) > 0.01)
      errors.push(
        `night art viewBox ratio (${round(nightBox.aspect)}) must match day (${round(dayBox.aspect)})`,
      );
  }

  // Recolor slots
  const available = availabilityOf([dayRaw, nightRaw]);
  const slots = def.colorSlots;
  if (slots !== undefined && !Array.isArray(slots)) {
    errors.push('"colorSlots" must be an array');
  } else if (Array.isArray(slots)) {
    const seen = new Set();
    for (const slot of slots) {
      if (!slot || typeof slot !== 'object') {
        errors.push('each color slot must be an object');
        continue;
      }
      if (typeof slot.id !== 'string' || !slot.id) {
        errors.push('color slot is missing "id"');
        continue;
      }
      if (seen.has(slot.id)) errors.push(`duplicate color slot id "${slot.id}"`);
      seen.add(slot.id);

      if (!available.ids.has(slot.id)) {
        errors.push(
          `color slot "${slot.id}" is not used in the SVG (expected var(--c-${slot.id}, …))`,
        );
      } else {
        const fallback = available.fallbacks.get(slot.id);
        if (
          fallback &&
          typeof slot.default === 'string' &&
          normalizeColor(fallback) !== normalizeColor(slot.default)
        )
          warnings.push(
            `slot "${slot.id}" default "${slot.default}" differs from the SVG fallback "${fallback}"`,
          );
      }
      if (typeof slot.label !== 'string' || !slot.label)
        warnings.push(`color slot "${slot.id}" has no label`);
      if (!Array.isArray(slot.palette) || slot.palette.length === 0)
        warnings.push(`color slot "${slot.id}" has an empty palette`);
      else if (slot.palette.some((c) => typeof c !== 'string'))
        errors.push(`color slot "${slot.id}" palette entries must be strings`);
      if (typeof slot.allowCustom !== 'boolean')
        warnings.push(`color slot "${slot.id}" should set allowCustom (true/false)`);
    }
  } else if (available.ids.size > 0) {
    infos.push(
      `SVG defines ${available.ids.size} recolor slot(s) but "colorSlots" is missing — recolour will not be offered`,
    );
  }

  // Presets
  if (def.presets !== undefined) {
    if (!Array.isArray(def.presets)) {
      errors.push('"presets" must be an array');
    } else {
      const slotIds = new Set((slots ?? []).map((s) => s?.id).filter(Boolean));
      const seen = new Set();
      for (const preset of def.presets) {
        if (!preset || typeof preset !== 'object') {
          errors.push('each preset must be an object');
          continue;
        }
        const name = preset.id ?? '?';
        if (typeof preset.id !== 'string' || !preset.id) errors.push('preset is missing "id"');
        else if (seen.has(preset.id)) warnings.push(`duplicate preset id "${preset.id}"`);
        else seen.add(preset.id);
        if (typeof preset.label !== 'string') warnings.push(`preset "${name}" has no label`);
        if (!preset.colors || typeof preset.colors !== 'object' || Array.isArray(preset.colors)) {
          errors.push(`preset "${name}" needs a "colors" object`);
          continue;
        }
        for (const [key, value] of Object.entries(preset.colors)) {
          if (!slotIds.has(key)) errors.push(`preset "${name}" references unknown slot "${key}"`);
          if (typeof value !== 'string')
            errors.push(`preset "${name}" colour "${key}" must be a string`);
        }
      }
    }
  }

  // Motion (item-level, then per-variant)
  checkMotion(def, log, 'item');
  for (const which of ['day', 'night']) {
    const variant = def.art?.[which];
    if (variant && typeof variant === 'object') checkMotion(variant, log, `${which} variant`);
  }

  return { id, errors, warnings, infos };
}

function cmdCheck(args) {
  const flags = parseArgs(args, ['json']);
  const jsonPath = flags._[0];
  if (!jsonPath) fail('check requires a JSON path: check <json> [--svg-dir <dir>]');
  const absoluteJson = resolve(jsonPath);
  const svgDir = flags['svg-dir'] !== undefined ? resolve(flags['svg-dir']) : dirname(absoluteJson);

  const parsed = readJson(absoluteJson);
  const isArray = Array.isArray(parsed);
  const entries = isArray ? parsed : [parsed];
  const results = entries.map((def) => checkEntry(def, { jsonPath: absoluteJson, svgDir }));

  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  const infos = results.flatMap((r) => r.infos);

  if (flags.json) {
    process.stdout.write(
      JSON.stringify(
        { file: jsonPath, ok: errors.length === 0, errors, warnings, infos },
        null,
        2,
      ) + '\n',
    );
  } else {
    console.log(`check ${jsonPath}`);
    for (const result of results) {
      console.log(`  ${result.id} — ${result.errors.length ? 'FAIL' : 'ok'}`);
      for (const message of result.errors) console.log(`    ✖ ${message}`);
      for (const message of result.warnings) console.log(`    ⚠ ${message}`);
      for (const message of result.infos) console.log(`    · ${message}`);
    }
    console.log(
      `${errors.length ? 'FAIL' : 'PASS'} — ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} note(s)`,
    );
  }

  return errors.length ? 1 : 0;
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`Journeybook room-decoration JSON assistant

Usage:
  node room-decor.mjs inspect <svg> [--night <svg>] [--json]
  node room-decor.mjs scaffold --svg <svg> [options]
  node room-decor.mjs check <json> [--svg-dir <dir>] [--json]

inspect
  Reports the viewBox, derived aspect, and every var(--c-…) recolor slot
  (with its SVG fallback) found in the art.

scaffold options
  --svg <path>          Day art (required).
  --night <path>        Night art; adds "art": { day, night } to the definition.
  --category <c>        ${CATEGORIES.join(' | ')} (default trinket)
  --layer <l>           ${LAYERS.join(' | ')} (default from category)
  --band <b>            ${BANDS.join(' | ')} (default from category)
  --attach <a>          ${ATTACH.join(' | ')} (surface items; default furniture)
  --host                Mark as a resting surface that can hold items (wall/floor only)
  --repeat <x|y|both>   Tile the art across the band
  --label <text>        Display label (default: title-cased file name)
  --scale <n>           defaultScale (default from category)
  --rotation <deg>      defaultRotation
  --presets <auto|none> Named colour presets (default auto; only when 2+ slots)
  --motion <file>       JSON fragment { effect?, animations?, particles? }
  --night-motion <file> JSON fragment merged into the night variant
  --out <path>          Write the JSON here (default: stdout)

check
  Validates a sidecar against the art: enums, aspect vs viewBox, that every
  slot is used in the SVG, preset references, and motion shape. Exits 1 on
  errors, 0 when only warnings/notes remain.`);
}

function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  if (command === 'inspect') return cmdInspect(rest);
  if (command === 'scaffold') return cmdScaffold(rest);
  if (command === 'check') return cmdCheck(rest);
  fail(`unknown command "${command}" (try: inspect | scaffold | check | help)`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`room-decor: ${error?.message ?? error}`);
    process.exitCode = 2;
  }
}

export {
  extractSlots,
  parseViewBox,
  CATEGORIES,
  LAYERS,
  BANDS,
  ATTACH,
  EFFECT_TYPES,
  PALETTE,
  SCHEMES,
};
