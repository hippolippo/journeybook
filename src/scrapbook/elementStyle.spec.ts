import { describe, expect, it } from 'vitest';
import type { PageElement } from '@/data/types';
import { elementStyle } from './elementStyle';

function note(patch: Partial<PageElement> = {}): PageElement {
  return {
    id: 'n',
    pageId: 'p',
    kind: 'note',
    text: 'hi',
    x: 0.5,
    y: 0.5,
    w: 0.5,
    h: 0.2,
    rotation: 0,
    z: 1,
    opacity: 1,
    ...patch,
  } as PageElement;
}

describe('elementStyle drop shadow', () => {
  it('omits the outer background for notes so the paper tint cannot bleed past corners', () => {
    expect(elementStyle(note({ color: '#ff0000' })).background).toBeUndefined();
  });

  it('adds a drop shadow only when enabled', () => {
    expect(elementStyle(note()).filter).toBeUndefined();
    expect(elementStyle(note({ dropShadow: true })).filter).toContain('drop-shadow');
  });

  it('scales the shadow with strength', () => {
    const soft = elementStyle(note({ dropShadow: true, shadowStrength: 0 }));
    const strong = elementStyle(note({ dropShadow: true, shadowStrength: 1 }));
    expect(soft.filter).not.toBe(strong.filter);
  });
});
