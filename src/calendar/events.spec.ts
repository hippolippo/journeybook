import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@/data/types';
import {
  countdownLabel,
  daysBetween,
  nextOccurrence,
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
