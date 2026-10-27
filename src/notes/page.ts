import type { NotePaper } from '@/scrapbook/notes';

/** Logical page geometry: fixed width, author-set height. */
export const NOTE_PAGE_WIDTH = 480;
export const NOTE_MIN_HEIGHT = 380;
export const NOTE_MAX_HEIGHT = 1100;
export const NOTE_DEFAULT_HEIGHT = 620;

/** Fixed rule rhythm for rich text; mixed font sizes cannot share one baseline. */
export const NOTE_RULE = 32;
/** First printed rule above the writing area. */
export const NOTE_TOP_RULE = 24;
/** Reference font size used to place the first text baseline on the first writing rule. */
export const NOTE_BASE_FONT = 22;

export function clampPageHeight(value: number): number {
  if (!Number.isFinite(value)) return NOTE_DEFAULT_HEIGHT;
  return Math.round(Math.max(NOTE_MIN_HEIGHT, Math.min(NOTE_MAX_HEIGHT, value)));
}

/** Background layers that recreate each note paper at the fixed rule rhythm. */
/**
 * Line box + top padding that put the first text baseline on the first writing
 * rule and keep every paragraph on the paper's rule rhythm.
 */
export function noteTextMetrics(
  paper: NotePaper,
  fontSize = NOTE_BASE_FONT,
): { lineHeight: number; paddingTop: number } {
  const lineHeight = NOTE_RULE * (paper.spacing ?? 1);
  const halfLeading = (lineHeight - fontSize) / 2;
  const ascent = fontSize * 0.78;
  const firstBaseline = NOTE_TOP_RULE + lineHeight;
  return {
    lineHeight,
    paddingTop: Math.max(20, Math.round((firstBaseline - halfLeading - ascent) * 100) / 100),
  };
}

export function notePaperStyle(
  paper: NotePaper,
  color: string | undefined,
  textureUrl?: string,
  scale = 1,
): Record<string, string> {
  const spacing = NOTE_RULE * (paper.spacing ?? 1) * scale;
  const topRule = NOTE_TOP_RULE * scale;
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];

  if (paper.lines === 'lined') {
    images.push(
      `repeating-linear-gradient(to bottom, ${paper.lineColor ?? 'rgba(74, 59, 46, 0.16)'} 0 1px, transparent 1px ${spacing}px)`,
    );
    sizes.push(`100% ${spacing}px`);
    positions.push(`0 ${topRule}px`);
    repeats.push('repeat');
  }
  if (paper.lines === 'grid') {
    images.push(
      `repeating-linear-gradient(to bottom, ${paper.lineColor ?? 'rgba(74, 59, 46, 0.14)'} 0 1px, transparent 1px ${spacing}px)`,
      `repeating-linear-gradient(to right, ${paper.lineColor ?? 'rgba(74, 59, 46, 0.1)'} 0 1px, transparent 1px ${spacing}px)`,
    );
    sizes.push(`100% ${spacing}px`, `${spacing}px 100%`);
    positions.push(`0 ${topRule}px`, `${42 * scale}px 0`);
    repeats.push('repeat', 'repeat');
  }
  if (paper.lines === 'dots') {
    images.push(
      `radial-gradient(${paper.lineColor ?? 'rgba(74, 59, 46, 0.22)'} ${1.4 * scale}px, transparent ${1.6 * scale}px)`,
    );
    sizes.push(`${spacing}px ${spacing}px`);
    positions.push(`${26 * scale}px ${24 * scale}px`);
    repeats.push('repeat');
  }
  if (paper.margin) {
    const marginX = 32 * scale;
    images.push(
      `linear-gradient(90deg, transparent ${marginX}px, ${paper.margin} ${marginX}px ${marginX + 1}px, transparent ${marginX + 1}px)`,
    );
    sizes.push('100% 100%');
    positions.push('0 0');
    repeats.push('no-repeat');
  }
  if (textureUrl) {
    images.push(`url("${textureUrl}")`);
    sizes.push(`${190 * scale}px ${190 * scale}px`);
    positions.push('0 0');
    repeats.push('repeat');
  }

  const style: Record<string, string> = {
    backgroundColor: color || paper.bg,
  };
  if (images.length) {
    style.backgroundImage = images.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundPosition = positions.join(', ');
    style.backgroundRepeat = repeats.join(', ');
  }
  return style;
}

/** Soft sheen for sticky-note papers. */
export function noteHasSheen(paper: NotePaper): boolean {
  return Boolean(paper.sheen);
}
