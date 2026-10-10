import { describe, expect, it } from 'vitest';
import { paperById, paperCss } from './paper';

describe('paper layout', () => {
  it('keeps ruled lines for built-in papers', () => {
    const css = paperCss(paperById('cream'));
    expect(css.backgroundImage).toContain('linear-gradient');
    expect(css.backgroundSize).toContain('34px');
  });

  it('loads a layered paper with fill, border and corner slots', () => {
    const paper = paperById('paper-meadow');
    expect(paper.fill?.colorSlots?.length).toBe(1);
    expect(paper.border?.colorSlots?.length).toBe(1);
    expect(paper.corners?.colorSlots?.length).toBe(2);
    expect(paper.colorSlots?.length).toBe(4);
    expect(paper.fill?.raw).toContain('--c-dot');
  });

  it('bakes fill slot colours into a data url and emits slot vars', () => {
    const css = paperCss(paperById('paper-meadow'), { edge: '#123456', dot: '#ff0000' });
    expect(css.backgroundImage).toContain('data:image/svg+xml');
    expect(css['--c-edge']).toBe('#123456');
    expect(css['--c-leaf']).toBe('#9caf88');
  });
});
