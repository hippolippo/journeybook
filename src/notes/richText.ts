import type { RichBlock, RichDoc, RichRun } from '@/data/types';
import { INK_COLORS, PENS } from '@/scrapbook/notes';

/**
 * Rich text for letters.
 *
 * The editor treats the contenteditable DOM as the live source and serialises it
 * through `htmlToDoc` on every input. The stored shape is a small, sanitised
 * block/run model, so reading a letter never means trusting persisted HTML.
 */
export interface NoteFont {
  id: string;
  label: string;
  family: string;
}

export const NOTE_FONTS: NoteFont[] = [
  ...PENS.map((pen) => ({ id: pen.id, label: pen.label, family: pen.family })),
  { id: 'print', label: 'Print', family: "'Nunito', system-ui, sans-serif" },
  { id: 'serif', label: 'Serif', family: "'Fraunces', Georgia, serif" },
];

export const NOTE_FONT_IDS = new Set(NOTE_FONTS.map((font) => font.id));

export const NOTE_SIZES = [10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48] as const;
export const NOTE_MIN_SIZE = 8;
export const NOTE_MAX_SIZE = 96;
export const NOTE_DEFAULT_SIZE = 20;

export const NOTE_INKS = [...INK_COLORS];
export const NOTE_HIGHLIGHTS = ['#f5e6a8', '#f7c9c9', '#cfe3c5', '#cfe0ea', '#e6dcf0'];
export const NOTE_ALIGNS = ['left', 'center', 'right'] as const;

export interface NoteTextStyle {
  font?: string;
  size?: number;
  color?: string;
  highlight?: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: 'left' | 'center' | 'right';
}

export const DEFAULT_TEXT_STYLE: NoteTextStyle = {
  font: 'pen',
  size: 22,
  color: NOTE_INKS[0] ?? '#4a3b2e',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: 'left',
};

export const EMPTY_DOC: RichDoc = { v: 1, blocks: [{ align: 'left', runs: [] }] };

const MAX_FONT_CACHE = 512;

export function fontById(id?: string): NoteFont {
  return NOTE_FONTS.find((font) => font.id === id) ?? NOTE_FONTS[0];
}

function normalizeFamily(value: string): string {
  return value.toLowerCase().replace(/["']/g, '').replace(/\s+/g, '');
}

const familyCache = new Map<string, string>();

/** Resolve a CSS font-family list (as emitted by execCommand) back to a font id. */
export function fontIdFromFamily(family?: string): string | undefined {
  if (!family) return undefined;
  if (familyCache.size > MAX_FONT_CACHE) familyCache.clear();
  const cached = familyCache.get(family);
  if (cached !== undefined) return cached || undefined;
  const first = normalizeFamily(family.split(',')[0] ?? '');
  const full = normalizeFamily(family);
  const found = NOTE_FONTS.find((font) => {
    const candidates = font.family.split(',').map(normalizeFamily);
    return candidates[0] === first || normalizeFamily(font.family) === full;
  });
  const id = found?.id ?? '';
  familyCache.set(family, id);
  return id || undefined;
}

/** Convert a CSS colour to a safe hex string, or undefined when unsupported. */
export function toHex(value?: string | null): string | undefined {
  if (!value) return undefined;
  const text = value.trim().toLowerCase();
  if (!text || text === 'transparent' || text === 'inherit' || text === 'initial') return undefined;
  const short = text.match(/^#([0-9a-f]{3})$/);
  if (short) {
    return `#${short[1]
      .split('')
      .map((char) => char + char)
      .join('')}`;
  }
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  const rgba = text.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/);
  if (rgba && Number(rgba[1]) <= 0) return undefined;
  const rgb = text.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
  if (rgb) {
    const channels = rgb.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part))));
    return `#${channels.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  }
  return undefined;
}

export function clampNoteSize(value: number): number {
  if (!Number.isFinite(value)) return NOTE_DEFAULT_SIZE;
  return Math.round(Math.max(NOTE_MIN_SIZE, Math.min(NOTE_MAX_SIZE, value)));
}

function normalizeRun(value: unknown): RichRun | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  if (typeof source.text !== 'string' || source.text.length === 0) return null;
  const text = source.text.replace(/\u00a0/g, ' ').replace(/\u200b/gi, '');
  if (!text) return null;
  const run: RichRun = { text };
  if (typeof source.font === 'string' && NOTE_FONT_IDS.has(source.font)) run.font = source.font;
  if (typeof source.size === 'number') run.size = clampNoteSize(source.size);
  const color = typeof source.color === 'string' ? toHex(source.color) : undefined;
  if (color) run.color = color;
  const highlight = typeof source.highlight === 'string' ? toHex(source.highlight) : undefined;
  if (highlight) run.highlight = highlight;
  if (source.bold === true) run.bold = true;
  if (source.italic === true) run.italic = true;
  if (source.underline === true) run.underline = true;
  if (source.strike === true) run.strike = true;
  return run;
}

function normalizeAlign(value: unknown): RichBlock['align'] {
  return value === 'center' || value === 'right' ? value : 'left';
}

/**
 * Validate a persisted or pasted document. Unknown styles and fonts are dropped
 * rather than trusted, and every colour is normalised to hex.
 */
export function normalizeDoc(value: unknown): RichDoc {
  if (!value || typeof value !== 'object') return cloneEmpty();
  const source = value as { v?: unknown; blocks?: unknown };
  if (source.v !== 1 || !Array.isArray(source.blocks)) return cloneEmpty();
  const blocks: RichBlock[] = [];
  for (const rawBlock of source.blocks) {
    if (!rawBlock || typeof rawBlock !== 'object') continue;
    const block = rawBlock as { align?: unknown; runs?: unknown };
    const runs: RichRun[] = [];
    if (Array.isArray(block.runs)) {
      for (const rawRun of block.runs) {
        const run = normalizeRun(rawRun);
        if (run) runs.push(run);
      }
    }
    blocks.push({ align: normalizeAlign(block.align), runs: mergeRuns(runs) });
  }
  return { v: 1, blocks: blocks.length ? blocks : cloneEmpty().blocks };
}

export function cloneEmpty(): RichDoc {
  return { v: 1, blocks: [{ align: 'left', runs: [] }] };
}

function sameStyle(a: RichRun, b: RichRun): boolean {
  return (
    a.font === b.font &&
    a.size === b.size &&
    a.color === b.color &&
    a.highlight === b.highlight &&
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike
  );
}

function mergeRuns(runs: RichRun[]): RichRun[] {
  const out: RichRun[] = [];
  for (const run of runs) {
    const last = out[out.length - 1];
    if (last && sameStyle(last, run)) last.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function runStyle(run: RichRun): string {
  const styles: string[] = [];
  if (run.font) styles.push(`font-family:${fontById(run.font).family}`);
  if (run.size) styles.push(`font-size:${run.size}px`);
  if (run.color) styles.push(`color:${run.color}`);
  if (run.highlight) styles.push(`background-color:${run.highlight}`);
  if (run.bold) styles.push('font-weight:700');
  if (run.italic) styles.push('font-style:italic');
  const decorations: string[] = [];
  if (run.underline) decorations.push('underline');
  if (run.strike) decorations.push('line-through');
  if (decorations.length) styles.push(`text-decoration:${decorations.join(' ')}`);
  return styles.join(';');
}

/** Serialise a document to safe HTML for the editor and the read view. */
export function docToHtml(doc: RichDoc): string {
  const blocks = doc.blocks.length ? doc.blocks : cloneEmpty().blocks;
  return blocks
    .map((block) => {
      const align = block.align === 'left' ? '' : ` style="text-align:${block.align}"`;
      const inner = block.runs
        .map((run) => {
          if (!run.text) return '';
          const text = escapeText(run.text).replace(/\n/g, '<br>');
          const style = runStyle(run);
          return style ? `<span style="${style}">${text}</span>` : text;
        })
        .join('');
      return `<p${align}>${inner || '<br>'}</p>`;
    })
    .join('');
}

interface InlineState {
  font?: string;
  size?: number;
  color?: string;
  highlight?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'IMG',
  'VIDEO',
  'AUDIO',
  'SVG',
  'MATH',
  'LINK',
  'META',
  'TEMPLATE',
  'TEXTAREA',
  'INPUT',
  'BUTTON',
  'SELECT',
]);

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'BLOCKQUOTE',
  'SECTION',
  'ARTICLE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

function inlineFromElement(element: Element, parent: InlineState): InlineState {
  const state: InlineState = { ...parent };
  const tag = element.tagName.toUpperCase();
  if (tag === 'B' || tag === 'STRONG') state.bold = true;
  if (tag === 'I' || tag === 'EM') state.italic = true;
  if (tag === 'U') state.underline = true;
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') state.strike = true;

  if (tag === 'FONT') {
    const font = fontIdFromFamily(element.getAttribute('face') ?? undefined);
    if (font) state.font = font;
    const color = toHex(element.getAttribute('color'));
    if (color) state.color = color;
  }

  const style = (element as HTMLElement).style;
  const font = fontIdFromFamily(style.fontFamily);
  if (font) state.font = font;
  const size = style.fontSize;
  if (size) {
    const parsed = Number.parseFloat(size);
    if (Number.isFinite(parsed)) state.size = clampNoteSize(parsed);
  }
  const color = toHex(style.color);
  if (color) state.color = color;
  const background = toHex(style.backgroundColor);
  if (background) state.highlight = background;
  const weight = style.fontWeight;
  if (weight === 'bold' || weight === 'bolder' || (Number.parseInt(weight, 10) || 0) >= 600)
    state.bold = true;
  if (style.fontStyle === 'italic' || style.fontStyle === 'oblique') state.italic = true;
  const decoration = `${style.textDecorationLine || ''} ${style.textDecoration || ''}`;
  if (decoration.includes('underline')) state.underline = true;
  if (decoration.includes('line-through')) state.strike = true;
  return state;
}

function alignFromElement(element: Element): RichBlock['align'] {
  const align = (element as HTMLElement).style.textAlign || element.getAttribute('align') || '';
  return align === 'center' || align === 'right' ? align : 'left';
}

function pushRun(runs: RichRun[], text: string, state: InlineState): void {
  if (!text) return;
  const run: RichRun = { text };
  if (state.font) run.font = state.font;
  if (state.size) run.size = state.size;
  if (state.color) run.color = state.color;
  if (state.highlight) run.highlight = state.highlight;
  if (state.bold) run.bold = true;
  if (state.italic) run.italic = true;
  if (state.underline) run.underline = true;
  if (state.strike) run.strike = true;
  runs.push(run);
}

function walkInline(node: Node, state: InlineState, runs: RichRun[]): void {
  if (node.nodeType === 3) {
    pushRun(runs, (node.nodeValue ?? '').replace(/\u00a0/g, ' '), state);
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (SKIP_TAGS.has(tag)) return;
  if (tag === 'BR') {
    pushRun(runs, '\n', state);
    return;
  }
  if (BLOCK_TAGS.has(tag)) {
    pushRun(runs, '\n', state);
  }
  const next = inlineFromElement(element, state);
  for (const child of Array.from(element.childNodes)) walkInline(child, next, runs);
}

function parseBlock(element: Element): RichBlock {
  const runs: RichRun[] = [];
  const state = inlineFromElement(element, {});
  for (const child of Array.from(element.childNodes)) {
    walkInline(child, state, runs);
  }
  const merged = mergeRuns(sanitizeRuns(runs));
  const meaningful = merged.some((run) => run.text.trim().length > 0);
  return { align: alignFromElement(element), runs: meaningful ? merged : [] };
}

function sanitizeRuns(runs: RichRun[]): RichRun[] {
  return runs.map((run) => normalizeRun(run)).filter((run): run is RichRun => run !== null);
}

function parseRoot(root: ParentNode): RichBlock[] {
  const blocks: RichBlock[] = [];
  let inlineRuns: RichRun[] = [];
  const flushInline = () => {
    if (!inlineRuns.length) return;
    blocks.push({ align: 'left', runs: mergeRuns(sanitizeRuns(inlineRuns)) });
    inlineRuns = [];
  };

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 1 && BLOCK_TAGS.has((child as Element).tagName.toUpperCase())) {
      flushInline();
      blocks.push(parseBlock(child as Element));
    } else if (child.nodeType === 3 && !(child.nodeValue ?? '').trim()) {
      // Ignore formatting whitespace between block elements.
      continue;
    } else {
      walkInline(child, {}, inlineRuns);
    }
  }
  flushInline();
  return blocks;
}

/** Parse editor HTML into the sanitised model. Never trusts tags or styles. */
export function htmlToDoc(html: string): RichDoc {
  if (!html || !html.trim()) return cloneEmpty();
  if (typeof document === 'undefined') return cloneEmpty();
  // A template's contents are inert: no scripts run and no images load.
  const template = document.createElement('template');
  template.innerHTML = html;
  const root: ParentNode = template.content ?? template;
  const blocks = parseRoot(root).map((block) => ({
    align: block.align,
    runs: mergeRuns(block.runs),
  }));
  if (!blocks.length) return cloneEmpty();
  if (!blocks.some((block) => block.runs.some((run) => run.text.trim()))) return cloneEmpty();
  return { v: 1, blocks };
}

export function docToPlainText(doc: RichDoc): string {
  return doc.blocks
    .map((block) => block.runs.map((run) => run.text).join(''))
    .join('\n')
    .replace(/\u00a0/g, ' ');
}

export function docPreview(doc: RichDoc, max = 90): string {
  const text = docToPlainText(doc).replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function isDocEmpty(doc: RichDoc): boolean {
  return !doc.blocks.some((block) => block.runs.some((run) => run.text.trim().length > 0));
}
