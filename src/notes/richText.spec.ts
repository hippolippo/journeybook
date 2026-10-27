import { describe, expect, it } from 'vitest';
import type { RichDoc } from '@/data/types';
import {
  EMPTY_DOC,
  clampNoteSize,
  docPreview,
  docToHtml,
  docToPlainText,
  fontIdFromFamily,
  htmlToDoc,
  isDocEmpty,
  normalizeDoc,
  toHex,
} from './richText';

const sample: RichDoc = {
  v: 1,
  blocks: [
    {
      align: 'center',
      runs: [
        { text: 'Dear Finn, ', font: 'pen', size: 24, color: '#8a3b3b', bold: true },
        { text: 'hello', font: 'print', size: 18, highlight: '#f5e6a8', italic: true },
      ],
    },
    {
      align: 'right',
      runs: [{ text: 'Yours', underline: true, strike: true }],
    },
  ],
};

describe('richText', () => {
  it('round-trips a sanitised document through HTML', () => {
    const parsed = htmlToDoc(docToHtml(sample));
    expect(parsed).toEqual(sample);
  });

  it('reads nested styles and alignment from editor HTML', () => {
    const doc = htmlToDoc(
      '<p style="text-align:center">Hi <span style="font-family:Caveat, cursive;color:rgb(138, 59, 59)"><b>there</b></span></p>',
    );
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].align).toBe('center');
    expect(doc.blocks[0].runs).toEqual([
      { text: 'Hi ' },
      { text: 'there', font: 'pen', color: '#8a3b3b', bold: true },
    ]);
  });

  it('strips invisible typing markers from runs', () => {
    const doc = htmlToDoc(
      '<p><span style="font-size:32px">\u200b</span><span style="font-size:32px">Hello</span></p>',
    );
    expect(doc.blocks[0].runs).toEqual([{ text: 'Hello', size: 32 }]);
    expect(docToHtml(doc)).not.toContain('\u200b');
  });

  it('ignores scripts, media and inline event handlers', () => {
    const doc = htmlToDoc(
      '<p>Safe</p><script>alert(1)</script><img src=x onerror="alert(1)"><p><a href="javascript:alert(1)">link</a></p>',
    );
    expect(docToPlainText(doc)).toBe('Safe\nlink');
    expect(docToHtml(doc)).not.toContain('script');
    expect(docToHtml(doc)).not.toContain('onerror');
    expect(docToHtml(doc)).not.toContain('href');
  });

  it('drops unknown fonts and unsafe colours, and clamps sizes', () => {
    const doc = normalizeDoc({
      v: 1,
      blocks: [
        {
          align: 'justify',
          runs: [
            {
              text: 'x',
              font: 'nope',
              size: 999,
              color: 'rgb(300, 0, 0)',
              highlight: 'not-a-colour',
            },
          ],
        },
      ],
    });
    expect(doc.blocks[0].align).toBe('left');
    expect(doc.blocks[0].runs[0].font).toBeUndefined();
    expect(doc.blocks[0].runs[0].size).toBe(96);
    expect(doc.blocks[0].runs[0].color).toBe('#ff0000');
    expect(doc.blocks[0].runs[0].highlight).toBeUndefined();
  });

  it('falls back to a single empty block for invalid input', () => {
    expect(normalizeDoc(null)).toEqual(EMPTY_DOC);
    expect(normalizeDoc({ v: 2, blocks: [] })).toEqual(EMPTY_DOC);
    expect(htmlToDoc('<p><br></p>')).toEqual(EMPTY_DOC);
    expect(isDocEmpty(htmlToDoc(''))).toBe(true);
  });

  it('keeps blank paragraphs between written ones', () => {
    const doc = htmlToDoc('<p>one</p><p><br></p><p>two</p>');
    expect(doc.blocks).toHaveLength(3);
    expect(docToPlainText(doc)).toBe('one\n\ntwo');
  });

  it('maps CSS font lists back to font ids', () => {
    expect(fontIdFromFamily("'Caveat', cursive")).toBe('pen');
    expect(fontIdFromFamily('Caveat')).toBe('pen');
    expect(fontIdFromFamily('Nunito, system-ui, sans-serif')).toBe('print');
    expect(fontIdFromFamily('Comic Sans, cursive')).toBeUndefined();
  });

  it('normalises colours and sizes', () => {
    expect(toHex('#abc')).toBe('#aabbcc');
    expect(toHex('rgb(1, 2, 3)')).toBe('#010203');
    expect(toHex('transparent')).toBeUndefined();
    expect(toHex('rgba(0, 0, 0, 0)')).toBeUndefined();
    expect(toHex('rgba(245, 230, 168, 0.5)')).toBe('#f5e6a8');
    expect(clampNoteSize(4)).toBe(8);
    expect(clampNoteSize(400)).toBe(96);
  });

  it('makes a short plain-text preview', () => {
    const long: RichDoc = {
      v: 1,
      blocks: [{ align: 'left', runs: [{ text: 'one two three four five six seven' }] }],
    };
    expect(docPreview(long, 12)).toBe('one two thr…');
    expect(docPreview(long)).toContain('one two three');
  });
});
