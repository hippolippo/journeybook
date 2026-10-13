import { describe, expect, it } from 'vitest';
import type { ColorSlot } from './types';
import { loadedStickers } from './loadDecor';

interface SlotWithShades extends ColorSlot {
  shades?: { color: string; deltaL: number }[];
}

const recolourable = loadedStickers.filter((s) => (s.colorSlots?.length ?? 0) > 0);

describe('recolourable stickers', () => {
  it('loads a large recolourable set', () => {
    expect(recolourable.length).toBeGreaterThan(90);
  });

  it('drives every recolourable sticker through colour-slot variables', () => {
    for (const s of recolourable) {
      expect(s.raw, `${s.id} should be inlined with slot vars`).toBeTruthy();
      expect(s.raw, `${s.id} should reference var(--c-…)`).toContain('var(--c-');
    }
  });

  it('offers a palette of distinct colours per slot', () => {
    for (const s of recolourable) {
      for (const slot of s.colorSlots ?? []) {
        const unique = new Set(slot.palette.map((c) => c.toUpperCase()));
        expect(unique.size, `${s.id}:${slot.id} palette should be all-different`).toBe(
          slot.palette.length,
        );
      }
    }
  });

  it('names slots after the part, not the colour family', () => {
    const colourNames = new Set([
      'cream', 'kraft', 'clay', 'poppy', 'berry', 'mustard', 'lavender', 'ink', 'teal',
    ]);
    for (const s of recolourable) {
      const labels = (s.colorSlots ?? []).map((slot) => slot.label.toLowerCase());
      expect(new Set(labels).size, `${s.id} slot labels should be unique`).toBe(labels.length);
      for (const label of labels) {
        expect(colourNames.has(label), `${s.id}: "${label}" is a colour name`).toBe(false);
      }
    }
  });

  it('derives linked shades from the chosen base colour', () => {
    const withShades = recolourable.filter((s) =>
      (s.colorSlots as SlotWithShades[]).some((slot) => (slot.shades?.length ?? 0) > 0),
    );
    expect(withShades.length).toBeGreaterThan(50);
    for (const s of withShades) {
      expect(s.raw, `${s.id} should derive shades with relative colour`).toContain(
        'oklch(from var(--c-',
      );
    }
  });
});
