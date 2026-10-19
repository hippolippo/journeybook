import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/data/types';
import {
  countdownLabel,
  daysBetween,
  nextOccurrence,
  occurrenceTitle,
  occurrencesInRange,
  occurrencesOnDay,
  soonestVisit,
  togetherNow,
  togetherStatus,
  upcoming,
} from './events';

function event(partial: Partial<CalendarEvent>): CalendarEvent {
  return { id: 'e1', kind: 'visit', title: 'trip', startsAt: '', recurrence: 'none', ...partial };
}

describe('daysBetween / countdownLabel', () => {
  const now = new Date(2026, 0, 10, 15, 0);

  it('counts whole calendar days', () => {
    expect(daysBetween(now, new Date(2026, 0, 10, 23, 0))).toBe(0);
    expect(daysBetween(now, new Date(2026, 0, 11, 1, 0))).toBe(1);
    expect(daysBetween(now, new Date(2026, 0, 20, 1, 0))).toBe(10);
  });

  it('labels the countdown', () => {
    expect(countdownLabel(new Date(2026, 0, 10, 23, 0), now)).toBe('today');
    expect(countdownLabel(new Date(2026, 0, 11, 9, 0), now)).toBe('tomorrow');
    expect(countdownLabel(new Date(2026, 0, 15, 9, 0), now)).toBe('in 5 days');
  });
});

describe('nextOccurrence', () => {
  it('keeps one-time events at their instant', () => {
    const visit = event({ startsAt: new Date(2026, 2, 1, 18, 0).toISOString() });
    const occ = nextOccurrence(visit, new Date(2026, 0, 1));
    expect(occ.start.getTime()).toBe(new Date(2026, 2, 1, 18, 0).getTime());
  });

  it('rolls yearly occurrences forward', () => {
    const anniversary = event({
      kind: 'anniversary',
      recurrence: 'yearly',
      startsAt: new Date(2020, 5, 15, 12, 0).toISOString(),
    });
    expect(nextOccurrence(anniversary, new Date(2026, 0, 1)).start.getFullYear()).toBe(2026);
    const after = nextOccurrence(anniversary, new Date(2026, 11, 31)).start;
    expect(after.getFullYear()).toBe(2027);
    expect(after.getMonth()).toBe(5);
    expect(after.getDate()).toBe(15);
  });

  it('rolls monthly and weekly occurrences forward', () => {
    const monthly = event({
      recurrence: 'monthly',
      startsAt: new Date(2026, 0, 10, 9, 0).toISOString(),
    });
    expect(nextOccurrence(monthly, new Date(2026, 0, 15)).start.getMonth()).toBe(1);

    const monday = new Date(2026, 0, 5, 9, 0);
    expect(monday.getDay()).toBe(1);
    const weekly = event({ recurrence: 'weekly', startsAt: monday.toISOString() });
    expect(nextOccurrence(weekly, new Date(2026, 0, 6)).start.getDate()).toBe(12);
    expect(nextOccurrence(weekly, new Date(2026, 0, 5, 8, 0)).start.getDate()).toBe(5);
  });
});

describe('together status', () => {
  const visit = event({
    id: 'v1',
    startsAt: new Date(2026, 0, 10, 18, 0).toISOString(),
    endsAt: new Date(2026, 0, 12, 12, 0).toISOString(),
  });

  it('detects an ongoing visit', () => {
    const during = togetherNow([visit], new Date(2026, 0, 11, 9, 0));
    expect(during?.until.getTime()).toBe(new Date(2026, 0, 12, 12, 0).getTime());
    expect(togetherNow([visit], new Date(2026, 0, 9, 9, 0))).toBeNull();
  });

  it('picks the soonest future visit and ignores past ones', () => {
    const past = event({ id: 'past', startsAt: new Date(2025, 0, 1).toISOString() });
    const later = event({ id: 'later', startsAt: new Date(2026, 3, 1).toISOString() });
    const sooner = event({ id: 'sooner', startsAt: new Date(2026, 1, 1).toISOString() });
    expect(soonestVisit([past, later, sooner], new Date(2026, 0, 15))?.event.id).toBe('sooner');
  });

  it('reports apart / together / none', () => {
    const now = new Date(2026, 0, 11, 9, 0);
    expect(togetherStatus([visit], now).state).toBe('together');
    expect(togetherStatus([visit], new Date(2026, 0, 9, 9, 0)).state).toBe('apart');
    expect(togetherStatus([], now).state).toBe('none');
  });
});

describe('occurrence queries', () => {
  it('expands recurring events within a range', () => {
    const birthday = event({
      kind: 'birthday',
      recurrence: 'yearly',
      startsAt: new Date(1995, 5, 15, 12, 0).toISOString(),
    });
    const found = occurrencesInRange([birthday], new Date(2026, 0, 1), new Date(2026, 11, 31));
    expect(found).toHaveLength(1);
    expect(found[0].start.getFullYear()).toBe(2026);
  });

  it('finds events overlapping a single day', () => {
    const visit = event({
      startsAt: new Date(2026, 0, 10, 18, 0).toISOString(),
      endsAt: new Date(2026, 0, 12, 12, 0).toISOString(),
    });
    expect(occurrencesOnDay([visit], new Date(2026, 0, 11, 9, 0))).toHaveLength(1);
    expect(occurrencesOnDay([visit], new Date(2026, 0, 5, 9, 0))).toHaveLength(0);
  });

  it('lists upcoming occurrences soonest first', () => {
    const a = event({ id: 'a', startsAt: new Date(2026, 4, 1).toISOString() });
    const b = event({ id: 'b', startsAt: new Date(2026, 1, 1).toISOString() });
    const list = upcoming([a, b], new Date(2026, 0, 1), 6);
    expect(list.map((o) => o.event.id)).toEqual(['b', 'a']);
  });
});

describe('recurrence anchors and numbered titles', () => {
  const anchor = new Date(2024, 5, 15, 12, 0).toISOString();
  const anniversary = event({
    kind: 'anniversary',
    recurrence: 'yearly',
    startsAt: anchor,
    title: 'Anniversary',
  });

  it('does not expand before the initial date by default', () => {
    expect(occurrencesInRange([anniversary], new Date(2020, 0, 1), new Date(2020, 11, 31))).toHaveLength(0);
    expect(occurrencesInRange([anniversary], new Date(2024, 0, 1), new Date(2024, 11, 31))).toHaveLength(1);
    expect(nextOccurrence(anniversary, new Date(2020, 0, 1)).start.getFullYear()).toBe(2024);
  });

  it('can show earlier occurrences when enabled', () => {
    const early = occurrencesInRange(
      [{ ...anniversary, showBeforeStart: true }],
      new Date(2020, 0, 1),
      new Date(2020, 11, 31),
    );
    expect(early).toHaveLength(1);
    expect(early[0].start.getFullYear()).toBe(2020);
  });

  it('uses % for the number and %% for the number plus suffix', () => {
    const birthday = event({
      kind: 'birthday',
      recurrence: 'yearly',
      startsAt: new Date(2005, 5, 15, 12, 0).toISOString(),
      title: '%% Birthday',
    });
    expect(occurrenceTitle(birthday, new Date(2026, 5, 15, 12, 0))).toBe('21st Birthday');
    expect(occurrenceTitle(anniversary, new Date(2025, 5, 15, 12, 0))).toBe('Anniversary');
    const leading = { ...anniversary, title: '%% Anniversary' };
    expect(occurrenceTitle(leading, new Date(2026, 5, 15, 12, 0))).toBe('2nd Anniversary');
    const repeated = { ...anniversary, title: 'Year %: %%' };
    expect(occurrenceTitle(repeated, new Date(2025, 5, 15, 12, 0))).toBe('Year 1: 1st');
  });

  it('uses digits after the sign(s) as the first value', () => {
    const numbered = { ...anniversary, title: '%%21 Birthday' };
    expect(occurrenceTitle(numbered, new Date(2024, 5, 15, 12, 0))).toBe('21st Birthday');
    expect(occurrenceTitle(numbered, new Date(2025, 5, 15, 12, 0))).toBe('22nd Birthday');
    const count = { ...anniversary, title: '%7 check-in' };
    expect(occurrenceTitle(count, new Date(2024, 5, 15, 12, 0))).toBe('7 check-in');
    expect(occurrenceTitle(count, new Date(2025, 5, 15, 12, 0))).toBe('8 check-in');
  });

  it('supports escaped percent and backslash characters', () => {
    const escaped = { ...anniversary, title: '100\\% done' };
    expect(occurrenceTitle(escaped, new Date(2025, 5, 15, 12, 0))).toBe('100% done');
    const path = { ...anniversary, title: 'C:\\\\memories \\\\ %' };
    expect(occurrenceTitle(path, new Date(2025, 5, 15, 12, 0))).toBe('C:\\memories \\ 1');
  });

  it('handles ordinal suffixes from zero', () => {
    const numbered = event({
      recurrence: 'yearly',
      startsAt: new Date(2000, 0, 1, 12, 0).toISOString(),
      title: '%% Birthday',
    });
    expect(occurrenceTitle(numbered, new Date(2000, 0, 1, 12, 0))).toBe('0th Birthday');
    expect(occurrenceTitle(numbered, new Date(2001, 0, 1, 12, 0))).toBe('1st Birthday');
    expect(occurrenceTitle(numbered, new Date(2002, 0, 1, 12, 0))).toBe('2nd Birthday');
    expect(occurrenceTitle(numbered, new Date(2011, 0, 1, 12, 0))).toBe('11th Birthday');
    expect(occurrenceTitle(numbered, new Date(2013, 0, 1, 12, 0))).toBe('13th Birthday');
    expect(occurrenceTitle(numbered, new Date(2021, 0, 1, 12, 0))).toBe('21st Birthday');
    expect(occurrenceTitle(numbered, new Date(2022, 0, 1, 12, 0))).toBe('22nd Birthday');
    expect(occurrenceTitle(numbered, new Date(2023, 0, 1, 12, 0))).toBe('23rd Birthday');
  });

  it('counts backward for early occurrences', () => {
    expect(
      occurrenceTitle(
        { ...anniversary, title: '%% Anniversary', showBeforeStart: true },
        new Date(2020, 5, 15, 12, 0),
      ),
    ).toBe('-4th Anniversary');
  });

  it('numbers monthly occurrences too', () => {
    const monthly = event({
      recurrence: 'monthly',
      startsAt: new Date(2026, 0, 10, 9, 0).toISOString(),
      title: '% check-in',
    });
    expect(occurrenceTitle(monthly, new Date(2026, 3, 10, 9, 0))).toBe('3 check-in');
  });
});
