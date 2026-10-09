import { describe, expect, it } from 'vitest';
import { angleFromCenter, normalizeAngle, resizeCorner } from './transform';

describe('normalizeAngle', () => {
  it('wraps into (-180, 180]', () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-190)).toBe(170);
    expect(normalizeAngle(190)).toBe(-170);
    expect(normalizeAngle(45)).toBe(45);
  });
});

describe('resizeCorner', () => {
  const base = { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0 };

  it('keeps the box when the pointer is on the corner', () => {
    const out = resizeCorner(base, { x: 0.6, y: 0.6 });
    expect(out.w).toBeCloseTo(0.2);
    expect(out.h).toBeCloseTo(0.2);
    expect(out.x).toBeCloseTo(0.5);
    expect(out.y).toBeCloseTo(0.5);
  });

  it('anchors the opposite corner and tracks the pointer 1:1', () => {
    // top-left corner is fixed at (0.4, 0.4); dragging the br corner +0.1 grows w/h by 0.1
    const out = resizeCorner(base, { x: 0.7, y: 0.7 });
    expect(out.w).toBeCloseTo(0.3);
    expect(out.h).toBeCloseTo(0.3);
    expect(out.x).toBeCloseTo(0.55);
    expect(out.y).toBeCloseTo(0.55);
  });

  it('preserves aspect ratio when locked', () => {
    const out = resizeCorner(base, { x: 0.7, y: 0.6 }, { locked: true });
    expect(out.w).toBeCloseTo(0.3);
    expect(out.h).toBeCloseTo(0.3);
  });

  it('accounts for rotation', () => {
    // br corner of a 90°-rotated box sits at (0.4, 0.6)
    const out = resizeCorner({ ...base, rotation: 90 }, { x: 0.4, y: 0.6 });
    expect(out.w).toBeCloseTo(0.2);
    expect(out.h).toBeCloseTo(0.2);
    expect(out.x).toBeCloseTo(0.5);
    expect(out.y).toBeCloseTo(0.5);
  });

  it('enforces a minimum size', () => {
    const out = resizeCorner(base, { x: 0.4, y: 0.4 });
    expect(out.w).toBe(0.03);
    expect(out.h).toBe(0.03);
  });
});

describe('angleFromCenter', () => {
  it('is 0 when the pointer is straight above the center', () => {
    expect(angleFromCenter({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.3 })).toBe(0);
  });
  it('is 90 when the pointer is to the right', () => {
    expect(angleFromCenter({ x: 0.5, y: 0.5 }, { x: 0.7, y: 0.5 })).toBe(90);
  });
});
