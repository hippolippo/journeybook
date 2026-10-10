/**
 * Generic, data-driven whole-object animation engine.
 *
 * The engine knows nothing about specific motions (sway, glow, flicker…). Any
 * sequence of transform / opacity / filter / custom-property stops is expressed
 * as data and compiled to a cached `@keyframes` rule at runtime. Named recipes
 * (see `recipes.ts`) are just data; nothing is special-cased here.
 */

/** One stop in an animation timeline; `at` is a percentage (0–100). */
export interface AnimationStop {
  at: number;
  transform?: string;
  opacity?: number;
  filter?: string;
  /** Extra CSS custom properties set at this stop. */
  vars?: Record<string, string>;
}

/**
 * A whole-object animation defined purely as data. Animations intentionally do
 * not target individual SVG parts — they move the object as a whole.
 */
export interface AnimationDef {
  /** Optional recipe name, used only to derive a stable `fx--<name>` class. */
  name?: string;
  keyframes: AnimationStop[];
  /** Seconds, e.g. "4s". */
  duration?: string;
  timing?: string;
  delay?: string;
  direction?: string;
  iterations?: string;
  fill?: string;
  /** transform-origin, e.g. "50% 100%". */
  origin?: string;
  /** CSS custom properties referenced by the keyframes (amplitudes, colours…). */
  vars?: Record<string, string>;
  /** Draw a soft radial bloom behind the art (used by glow recipes). */
  bloom?: boolean;
  /** Only active at night; filtered out by the resolver during the day. */
  nightOnly?: boolean;
}

const STYLE_ID = 'jb-fx-keyframes';
const nameByKey = new Map<string, string>();
const injected = new Set<string>();

function keyframesKey(stops: AnimationStop[]): string {
  return JSON.stringify(stops);
}

function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function clampPct(at: number): number {
  return Math.max(0, Math.min(100, at));
}

function stopCss(stop: AnimationStop): string {
  const parts: string[] = [];
  if (stop.transform) parts.push(`transform:${stop.transform}`);
  if (stop.opacity != null) parts.push(`opacity:${stop.opacity}`);
  if (stop.filter) parts.push(`filter:${stop.filter}`);
  if (stop.vars) for (const [key, value] of Object.entries(stop.vars)) parts.push(`${key}:${value}`);
  return parts.join(';');
}

function keyframesCss(name: string, stops: AnimationStop[]): string {
  const body = stops.map((s) => `${clampPct(s.at)}%{${stopCss(s)}}`).join('');
  return `@keyframes ${name}{${body}}`;
}

function injectCss(css: string): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.appendChild(document.createTextNode(css));
}

/** Register (once) and return the animation name for a set of keyframes. */
export function ensureKeyframes(stops: AnimationStop[]): string {
  const key = keyframesKey(stops);
  const existing = nameByKey.get(key);
  if (existing) return existing;
  const name = `jb-kf-${hash(key)}`;
  nameByKey.set(key, name);
  if (!injected.has(key)) {
    injected.add(key);
    injectCss(keyframesCss(name, stops));
  }
  return name;
}

/** Inline style that applies an animation definition to an element. */
export function animationStyle(def: AnimationDef): Record<string, string> {
  const style: Record<string, string> = {
    animationName: ensureKeyframes(def.keyframes),
    animationDuration: def.duration ?? '4s',
    animationTimingFunction: def.timing ?? 'ease-in-out',
    animationDelay: def.delay ?? '0s',
    animationDirection: def.direction ?? 'normal',
    animationIterationCount: def.iterations ?? 'infinite',
    animationFillMode: def.fill ?? 'both',
  };
  if (def.origin) style.transformOrigin = def.origin;
  if (def.vars) Object.assign(style, def.vars);
  return style;
}

/** The stable class name for an animation recipe, e.g. `fx--sway`. */
export function animationClass(def: AnimationDef): string {
  return def.name ? `fx--${def.name}` : '';
}
