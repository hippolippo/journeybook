import { describe, expect, it } from 'vitest';
import type { UserRole } from '@/data/types';
import { DIRECTION_LABEL, directionLabel, directionOptions, type DirectionContext } from './meta';

function ctx(myRole: UserRole | null, myName = '', partnerName = ''): DirectionContext {
  return { myRole, myName, partnerName };
}

describe('directionLabel', () => {
  it('falls back to generic labels when the role is unknown', () => {
    expect(directionLabel('to-her', ctx(null))).toBe(DIRECTION_LABEL['to-her']);
    expect(directionLabel('to-me', ctx(null))).toBe(DIRECTION_LABEL['to-me']);
    expect(directionLabel('together', ctx(null))).toBe('Traveling together');
  });

  it('reads from his perspective', () => {
    const c = ctx('him', 'Alex', 'Robin');
    expect(directionLabel('to-her', c)).toBe('I go to Robin');
    expect(directionLabel('to-me', c)).toBe('Robin comes to me');
    expect(directionLabel('together', c)).toBe('Traveling together');
  });

  it('flips for her perspective', () => {
    const c = ctx('her', 'Robin', 'Alex');
    expect(directionLabel('to-her', c)).toBe('Alex comes to me');
    expect(directionLabel('to-me', c)).toBe('I go to Alex');
  });

  it('uses pronouns when names are missing', () => {
    expect(directionLabel('to-her', ctx('him'))).toBe('I go to her');
    expect(directionLabel('to-her', ctx('her'))).toBe('He comes to me');
    expect(directionLabel('to-me', ctx('him'))).toBe('She comes to me');
    expect(directionLabel('to-me', ctx('her'))).toBe('I go to him');
  });
});

describe('directionOptions', () => {
  it('returns one labelled option per direction', () => {
    const options = directionOptions(ctx('him', 'Alex', 'Robin'));
    expect(options.map((o) => o.value)).toEqual(['to-her', 'to-me', 'together']);
    expect(options[0].label).toBe('I go to Robin');
  });
});
