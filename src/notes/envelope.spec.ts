import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENVELOPE,
  ENVELOPE_TINTS,
  SEAL_STICKER,
  STAMP_STICKER,
  STAMP_PRESETS,
  envelopeInk,
  normalizeEnvelope,
  stampPresetById,
} from './envelope';
import {
  NOTE_DEFAULT_HEIGHT,
  NOTE_MAX_HEIGHT,
  NOTE_MIN_HEIGHT,
  NOTE_PAGE_WIDTH,
  clampPageHeight,
  notePaperStyle,
  noteTextMetrics,
} from './page';
import { notePaperById } from '@/scrapbook/notes';

describe('notes envelope', () => {
  it('borrows the shipped seal and stamp art', () => {
    expect(SEAL_STICKER.raw).toBeTruthy();
    expect(STAMP_STICKER.raw).toBeTruthy();
    expect(SEAL_STICKER.colorSlots?.[0]?.id).toBe('seal');
    expect(STAMP_STICKER.colorSlots?.map((slot) => slot.id)).toEqual(['paper', 'waves']);
  });

  it('normalises persisted envelopes', () => {
    expect(normalizeEnvelope(undefined)).toEqual(DEFAULT_ENVELOPE);
    expect(normalizeEnvelope({ tint: '#abc', seal: 'not-a-colour', stamp: 'nope' })).toEqual({
      tint: '#aabbcc',
      seal: DEFAULT_ENVELOPE.seal,
      stamp: DEFAULT_ENVELOPE.stamp,
    });
    expect(
      normalizeEnvelope({ tint: '#abc', seal: '#123456', stamp: 'sky', initial: 'j' }),
    ).toEqual({
      tint: '#aabbcc',
      seal: '#123456',
      stamp: 'sky',
      initial: 'J',
    });
    expect(normalizeEnvelope({ tint: '#4d4640', seal: '#f6e7c9', stamp: 'sky' })).toEqual({
      tint: '#4d4640',
      seal: '#f6e7c9',
      stamp: 'sky',
    });
    expect(
      normalizeEnvelope({
        tint: '#123',
        seal: '#456',
        stamp: 'sky',
        stampPaper: '#112233',
        stampWaves: '#445566',
      }),
    ).toMatchObject({
      tint: '#112233',
      seal: '#445566',
      stamp: 'sky',
      stampPaper: '#112233',
      stampWaves: '#445566',
    });
    expect(normalizeEnvelope({ stampPaper: 'nope', stampWaves: '#abc' })).toMatchObject({
      stampWaves: '#aabbcc',
    });
  });

  it('keeps the address readable on dark tints', () => {
    expect(envelopeInk('#4d4640')).toBe('#f7efdd');
    expect(envelopeInk('#f4e6ca')).toBe('#4a3b2e');
    expect(ENVELOPE_TINTS.length).toBeGreaterThan(4);
  });

  it('falls back to the first stamp preset', () => {
    expect(stampPresetById('nope')).toBe(STAMP_PRESETS[0]);
    expect(stampPresetById('sky').paper).toBe('#8FB4C4');
  });
});

describe('notes page', () => {
  it('clamps the author-set height', () => {
    expect(clampPageHeight(0)).toBe(NOTE_MIN_HEIGHT);
    expect(clampPageHeight(9999)).toBe(NOTE_MAX_HEIGHT);
    expect(clampPageHeight(Number.NaN)).toBe(NOTE_DEFAULT_HEIGHT);
    expect(clampPageHeight(612.6)).toBe(613);
  });

  it('builds ruled paper at the fixed rhythm', () => {
    const style = notePaperStyle(notePaperById('lined'), '#fdf8ef');
    expect(style.backgroundColor).toBe('#fdf8ef');
    expect(style.backgroundImage).toContain('repeating-linear-gradient');
    expect(style.backgroundSize).toBe('100% 32px');
    expect(style.backgroundPosition).toBe('0 24px');
    expect(notePaperStyle(notePaperById('wide'), '#fdf8ef').backgroundSize).toBe('100% 64px');
    expect(NOTE_PAGE_WIDTH).toBe(480);
  });

  it('puts the first text baseline on the first writing rule', () => {
    const lined = noteTextMetrics(notePaperById('lined'));
    expect(lined.lineHeight).toBe(32);
    expect(lined.paddingTop).toBeCloseTo(33.84, 1);
    const wide = noteTextMetrics(notePaperById('wide'));
    expect(wide.lineHeight).toBe(64);
    expect(wide.paddingTop).toBeCloseTo(49.84, 1);
  });

  it('scales preview patterns and keeps the kraft texture', () => {
    const kraft = notePaperById('kraft');
    const preview = notePaperStyle(kraft, kraft.bg, 'data:image/svg+xml,test', 0.25);
    expect(preview.backgroundImage).toContain('url("data:image/svg+xml,test")');
    expect(preview.backgroundSize).toBe('47.5px 47.5px');
    expect(notePaperStyle(notePaperById('lined'), '#fff', undefined, 0.25).backgroundSize).toBe(
      '100% 8px',
    );
  });

  it('builds grid, dots and margin layers', () => {
    const grid = notePaperStyle(notePaperById('grid'), '#fff');
    expect(grid.backgroundImage?.split('gradient').length).toBe(3);
    expect(grid.backgroundSize).toContain('100% 32px');
    expect(grid.backgroundSize).toContain('32px 100%');
    expect(notePaperStyle(notePaperById('dots'), '#fff').backgroundImage).toContain(
      'radial-gradient',
    );
    expect(notePaperStyle(notePaperById('index'), '#fdf8ef').backgroundImage).toContain('#d98c8c');
  });
});
