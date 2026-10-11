import { describe, expect, it } from 'vitest';
import type { NoteElement } from '@/data/types';
import {
  NOTE_PAPERS,
  PENS,
  noteDotsStyle,
  noteGridStyle,
  noteInnerStyle,
  noteLinedStyle,
  notePaperById,
  noteTextStyle,
  penById,
} from './notes';

function note(patch: Partial<NoteElement> = {}): NoteElement {
  return { id: 'n', pageId: 'p', kind: 'note', text: 'hi', x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, z: 1, opacity: 1, ...patch };
}

describe('pens', () => {
  it('falls back to the first pen', () => {
    expect(penById('nope').id).toBe(PENS[0].id);
  });
  it('offers several handwriting pens', () => {
    expect(PENS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('papers', () => {
  it('falls back to sticky', () => {
    expect(notePaperById(undefined).id).toBe('sticky');
    expect(NOTE_PAPERS.length).toBeGreaterThanOrEqual(5);
  });

  it('loads papers from asset JSON (textures, sheen, palettes)', () => {
    const kraft = notePaperById('kraft');
    expect(kraft.texture).toBeTruthy();
    const sticky = notePaperById('sticky');
    expect(sticky.sheen).toBe(true);
    expect(sticky.palette?.length).toBeGreaterThan(0);
    expect(notePaperById('index').margin).toBeTruthy();
    expect(notePaperById('wide').spacing).toBe(2);
  });

  it('uses the paper background for non-colorable papers, ignoring tint', () => {
    const style = noteInnerStyle(note({ paper: 'sticky-rose', color: '#00ff00' }));
    expect(style.background).toBe(notePaperById('sticky-rose').bg);
  });

  it('uses the tint for colorable papers', () => {
    expect(noteInnerStyle(note({ paper: 'sticky', color: '#ff0000' })).background).toBe('#ff0000');
    // Ruled papers carry a tint too now, so colour variations work everywhere.
    expect(noteInnerStyle(note({ paper: 'lined', color: '#ff0000' })).background).toBe('#ff0000');
  });

  it('is transparent for no paper', () => {
    expect(noteInnerStyle(note({ paper: 'none', color: '#ff0000' })).background).toBe('transparent');
  });
});

describe('note paper patterns follow the text', () => {
  it('aligns lined rules to the first text baseline', () => {
    const style = noteLinedStyle(note({ paper: 'lined' }));
    expect(style.backgroundImage).toContain('repeating-linear-gradient');
    expect(style.backgroundPosition).not.toBe('0 0px');
  });

  it('aligns grid rules to the same baseline as lined paper', () => {
    const el = note({ paper: 'grid' });
    const baseline = noteLinedStyle(el).backgroundPosition.split(' ')[1];
    const grid = noteGridStyle(el);
    expect(grid.backgroundImage).toContain('linear-gradient');
    expect(grid.backgroundPosition).toContain(baseline);
  });

  it('anchors dots to the text baseline and left edge', () => {
    const dots = noteDotsStyle(note({ paper: 'dots' }));
    expect(dots.backgroundImage).toContain('radial-gradient');
    const y = dots.backgroundPosition.split(' ')[1];
    expect(Number.parseFloat(y)).toBeGreaterThan(0);
  });
});

describe('note text style', () => {
  it('applies pen, size, ink and effects', () => {
    const s = noteTextStyle(note({ font: 'marker', size: 30, ink: '#123456', bold: true, uppercase: true, shadow: true }));
    expect(s.fontFamily).toContain('Permanent Marker');
    expect(s.fontSize).toBe('30px');
    expect(s.color).toBe('#123456');
    expect(s.textTransform).toBe('uppercase');
    expect(s.textShadow).not.toBe('none');
  });
});
