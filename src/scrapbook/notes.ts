import type { NoteElement } from '@/data/types';

export interface Pen {
  id: string;
  label: string;
  family: string;
  weight: number;
  italic?: boolean;
  letterSpacing?: number;
}

export const PENS: Pen[] = [
  { id: 'pen', label: 'Pen', family: "'Caveat', cursive", weight: 600 },
  { id: 'neat', label: 'Neat', family: "'Patrick Hand', cursive", weight: 400 },
  { id: 'marker', label: 'Marker', family: "'Permanent Marker', cursive", weight: 400, letterSpacing: 0.2 },
  { id: 'brush', label: 'Brush', family: "'Caveat Brush', cursive", weight: 400 },
  { id: 'pencil', label: 'Pencil', family: "'Architects Daughter', cursive", weight: 400 },
  { id: 'script', label: 'Script', family: "'Homemade Apple', cursive", weight: 400 },
  { id: 'thin', label: 'Thin pen', family: "'Shadows Into Light', cursive", weight: 400 },
  { id: 'round', label: 'Round', family: "'Shantell Sans', cursive", weight: 500 },
  { id: 'chalk', label: 'Chalk', family: "'Gochi Hand', cursive", weight: 400 },
  { id: 'journal', label: 'Journal', family: "'Kalam', cursive", weight: 400 },
];

export function penById(id?: string): Pen {
  return PENS.find((p) => p.id === id) ?? PENS[0];
}

export interface NotePaper {
  id: string;
  label: string;
  bg: string;
  radius: number;
  shadow: boolean;
  lines?: 'lined' | 'grid' | 'dots';
  colorable: boolean;
}

export const NOTE_PAPERS: NotePaper[] = [
  { id: 'sticky', label: 'Sticky note', bg: '#f6e8a8', radius: 3, shadow: true, colorable: true },
  { id: 'lined', label: 'Lined', bg: '#fdf8ef', radius: 3, shadow: true, lines: 'lined', colorable: false },
  { id: 'grid', label: 'Grid', bg: '#ffffff', radius: 3, shadow: true, lines: 'grid', colorable: false },
  { id: 'dots', label: 'Dot grid', bg: '#ffffff', radius: 3, shadow: true, lines: 'dots', colorable: false },
  { id: 'kraft', label: 'Kraft', bg: '#e8d9c0', radius: 3, shadow: true, colorable: true },
  { id: 'none', label: 'No paper', bg: 'transparent', radius: 0, shadow: false, colorable: false },
];

export function notePaperById(id?: string): NotePaper {
  return NOTE_PAPERS.find((p) => p.id === id) ?? NOTE_PAPERS[0];
}

export const INK_COLORS = ['#4a3b2e', '#2f3134', '#8a3b3b', '#3b5c8a', '#3b6b4f', '#7a4a8a', '#b06a2c', '#f4efe6'];
export const NOTE_PAPER_COLORS = ['#f6e8a8', '#f7c9c9', '#cfe3c5', '#cfe0ea', '#e8d9c0', '#e6dcf0', '#fdf8ef', '#3b3a44'];

const DEFAULT_INK = '#4a3b2e';

function fontCss(el: NoteElement): string {
  const pen = penById(el.font);
  const weight = pen.weight + (el.bold ? 200 : 0);
  const italic = el.italic || pen.italic ? 'italic' : 'normal';
  return `${italic} ${weight} ${el.size ?? 18}px ${pen.family}`;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function ctx(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx = document.createElement('canvas').getContext('2d');
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

const metricsCache = new Map<string, { ascent: number; descent: number }>();
function fontMetrics(font: string, size: number): { ascent: number; descent: number } {
  const cached = metricsCache.get(font);
  if (cached) return cached;
  let result = { ascent: size * 0.78, descent: size * 0.22 };
  const c = ctx();
  if (c) {
    try {
      c.font = font;
      const m = c.measureText('Hxg');
      const a = (m as TextMetrics & { fontBoundingBoxAscent?: number }).fontBoundingBoxAscent ?? m.actualBoundingBoxAscent;
      const d = (m as TextMetrics & { fontBoundingBoxDescent?: number }).fontBoundingBoxDescent ?? m.actualBoundingBoxDescent;
      if (typeof a === 'number' && typeof d === 'number' && a > 0) result = { ascent: a, descent: d };
    } catch {
      /* keep fallback */
    }
  }
  metricsCache.set(font, result);
  return result;
}

const linesCache = new Map<string, number>();
function countLines(text: string, font: string, maxWidth: number): number {
  const key = `${font}|${Math.round(maxWidth)}|${text}`;
  const cached = linesCache.get(key);
  if (cached !== undefined) return cached;
  const paragraphs = text.split('\n');
  const c = ctx();
  let lines = 0;
  if (!c || maxWidth <= 0) {
    lines = Math.max(1, paragraphs.length);
  } else {
    c.font = font;
    for (const p of paragraphs) {
      if (!p) {
        lines += 1;
        continue;
      }
      let cur = '';
      let n = 1;
      for (const word of p.split(/\s+/)) {
        const test = cur ? `${cur} ${word}` : word;
        if (!cur || c.measureText(test).width <= maxWidth) {
          cur = test;
        } else {
          n += 1;
          cur = word;
        }
      }
      lines += n;
    }
  }
  const result = Math.max(1, lines);
  if (linesCache.size > 500) linesCache.clear();
  linesCache.set(key, result);
  return result;
}

/** Ruled lines for lined paper, positioned so they sit on the text baselines. */
export function noteLinedStyle(el: NoteElement): Record<string, string> {
  const size = el.size ?? 18;
  const lh = el.lineHeight ?? 1.3;
  const lineHeightPx = size * lh;
  const font = fontCss(el);
  const { ascent, descent } = fontMetrics(font, size);
  const halfLeading = (lineHeightPx - (ascent + descent)) / 2;
  const padY = Math.round(size * 0.45);
  const padX = Math.round(size * 0.6);
  const contentH = (el.h ?? 0.2) * 480 - 2 * padY;
  const contentW = (el.w ?? 0.5) * 480 - 2 * padX;
  const blockH = countLines(el.text ?? '', font, contentW) * lineHeightPx;
  const valign = el.valign ?? 'middle';
  const topOffset = valign === 'top' ? 0 : valign === 'bottom' ? contentH - blockH : (contentH - blockH) / 2;
  const firstBaseline = padY + topOffset + halfLeading + ascent;
  const color = 'rgba(74, 59, 46, 0.18)';
  return {
    backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0, ${color} 1px, transparent 1px, transparent ${lineHeightPx}px)`,
    backgroundSize: `100% ${lineHeightPx}px`,
    backgroundPosition: `0 ${firstBaseline.toFixed(2)}px`,
    backgroundRepeat: 'repeat',
  };
}

export function noteInnerStyle(el: NoteElement): Record<string, string> {
  const paper = notePaperById(el.paper ?? 'sticky');
  const size = el.size ?? 18;
  const lh = el.lineHeight ?? 1.3;
  const spacing = Math.max(12, Math.round(size * lh));
  const lineColor = paper.id === 'kraft' ? 'rgba(74,59,46,0.2)' : 'rgba(74,59,46,0.16)';
  const paperBg = paper.bg === 'transparent' ? 'transparent' : paper.colorable ? (el.color ?? paper.bg) : paper.bg;
  const style: Record<string, string> = {
    background: paperBg,
    borderRadius: `${paper.radius}px`,
    boxShadow: paper.shadow ? 'var(--shadow-sm)' : 'none',
    padding: paper.id === 'none' ? '0' : `${Math.round(size * 0.45)}px ${Math.round(size * 0.6)}px`,
    justifyContent: el.valign === 'top' ? 'flex-start' : el.valign === 'bottom' ? 'flex-end' : 'center',
  };
  if (paper.lines === 'lined') {
    Object.assign(style, noteLinedStyle(el));
  } else if (paper.lines === 'grid') {
    style.backgroundImage = `linear-gradient(${lineColor} 1px, transparent 1px), linear-gradient(90deg, ${lineColor} 1px, transparent 1px)`;
    style.backgroundSize = `${spacing}px ${spacing}px, ${spacing}px ${spacing}px`;
  } else if (paper.lines === 'dots') {
    style.backgroundImage = `radial-gradient(${lineColor} 1.2px, transparent 1.4px)`;
    style.backgroundSize = `${Math.round(spacing * 0.8)}px ${Math.round(spacing * 0.8)}px`;
  }
  return style;
}

export function noteTextStyle(el: NoteElement): Record<string, string> {
  const pen = penById(el.font);
  return {
    fontFamily: pen.family,
    fontWeight: String(pen.weight + (el.bold ? 200 : 0)),
    fontStyle: el.italic || pen.italic ? 'italic' : 'normal',
    fontSize: `${el.size ?? 18}px`,
    color: el.ink ?? DEFAULT_INK,
    textAlign: el.align ?? 'center',
    lineHeight: String(el.lineHeight ?? 1.3),
    textTransform: el.uppercase ? 'uppercase' : 'none',
    textShadow: el.shadow ? '0 1px 2px rgba(0, 0, 0, 0.25)' : 'none',
    letterSpacing: pen.letterSpacing ? `${pen.letterSpacing}px` : 'normal',
  };
}
