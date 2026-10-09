import type { CalendarEvent, Recurrence } from '@/data/types';

const DAY_MS = 86_400_000;

export interface Occurrence {
  event: CalendarEvent;
  start: Date;
  end: Date | null;
}

export type TogetherStatus =
  | { state: 'together'; event: CalendarEvent; until: Date }
  | { state: 'apart'; event: CalendarEvent; start: Date; days: number }
  | { state: 'none' };

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Whole calendar days between two instants (local midnight-relative). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

function endsFor(event: CalendarEvent, start: Date): Date | null {
  if (!event.endsAt) return null;
  const duration = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  return duration > 0 ? new Date(start.getTime() + duration) : null;
}

/** The next start of a recurring event at or after `ref`. */
function nextRecurringStart(event: CalendarEvent, ref: Date): Date {
  const anchor = new Date(event.startsAt);
  const hours = anchor.getHours();
  const minutes = anchor.getMinutes();
  if (event.recurrence === 'yearly') {
    const candidate = new Date(ref);
    candidate.setMonth(anchor.getMonth(), anchor.getDate());
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() < ref.getTime()) candidate.setFullYear(candidate.getFullYear() + 1);
    return candidate;
  }
  if (event.recurrence === 'monthly') {
    const candidate = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      anchor.getDate(),
      hours,
      minutes,
      0,
      0,
    );
    if (candidate.getTime() < ref.getTime()) candidate.setMonth(candidate.getMonth() + 1);
    return candidate;
  }
  const candidate = new Date(ref);
  candidate.setHours(hours, minutes, 0, 0);
  const delta = (anchor.getDay() - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + delta);
  if (candidate.getTime() < ref.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

/** The next occurrence of an event at or after `now` (one-time events may be past). */
export function nextOccurrence(event: CalendarEvent, now: Date): Occurrence {
  if (event.recurrence === 'none') {
    const start = new Date(event.startsAt);
    return { event, start, end: endsFor(event, start) };
  }
  const start = nextRecurringStart(event, now);
  return { event, start, end: endsFor(event, start) };
}

/** Every occurrence overlapping [from, to], sorted by start. */
export function occurrencesInRange(events: CalendarEvent[], from: Date, to: Date): Occurrence[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const out: Occurrence[] = [];
  for (const event of events) {
    if (event.recurrence === 'none') {
      const start = new Date(event.startsAt);
      const end = endsFor(event, start);
      const endMs = end ? end.getTime() : start.getTime();
      if (endMs >= fromMs && start.getTime() <= toMs) out.push({ event, start, end });
      continue;
    }
    let cursor = nextRecurringStart(event, from);
    let guard = 0;
    while (cursor.getTime() <= toMs && guard++ < 500) {
      out.push({ event, start: cursor, end: endsFor(event, cursor) });
      cursor = nextRecurringStart(event, new Date(cursor.getTime() + 1));
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Occurrences on a single local day. */
export function occurrencesOnDay(events: CalendarEvent[], day: Date): Occurrence[] {
  const from = startOfDay(day);
  const to = new Date(from.getTime() + DAY_MS - 1);
  return occurrencesInRange(events, from, to);
}

/** A visit is ongoing if `now` falls inside its window. */
export function togetherNow(
  events: CalendarEvent[],
  now: Date,
): { event: CalendarEvent; until: Date } | null {
  for (const event of events) {
    if (event.kind !== 'visit' || event.recurrence !== 'none') continue;
    const start = new Date(event.startsAt).getTime();
    const end = event.endsAt ? new Date(event.endsAt).getTime() : start;
    if (now.getTime() >= start && now.getTime() <= end) return { event, until: new Date(end) };
  }
  return null;
}

/** The soonest visit that starts in the future. */
export function soonestVisit(events: CalendarEvent[], now: Date): Occurrence | null {
  let best: Occurrence | null = null;
  for (const event of events) {
    if (event.kind !== 'visit') continue;
    const occurrence = nextOccurrence(event, now);
    if (occurrence.start.getTime() < now.getTime()) continue;
    if (!best || occurrence.start.getTime() < best.start.getTime()) best = occurrence;
  }
  return best;
}

/** Resolve the "are we together / how long until we are" status for the countdown. */
export function togetherStatus(events: CalendarEvent[], now: Date): TogetherStatus {
  const together = togetherNow(events, now);
  if (together) return { state: 'together', event: together.event, until: together.until };
  const visit = soonestVisit(events, now);
  if (visit)
    return {
      state: 'apart',
      event: visit.event,
      start: visit.start,
      days: daysBetween(now, visit.start),
    };
  return { state: 'none' };
}

/** Upcoming occurrences (including ongoing visits), soonest first. */
export function upcoming(events: CalendarEvent[], now: Date, limit = 6): Occurrence[] {
  const horizon = new Date(now);
  horizon.setFullYear(horizon.getFullYear() + 2);
  return occurrencesInRange(events, now, horizon)
    .filter((o) => (o.end ?? o.start).getTime() >= now.getTime())
    .slice(0, limit);
}

export function countdownLabel(date: Date, now: Date): string {
  const days = daysBetween(now, date);
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: 'one-time',
  yearly: 'every year',
  monthly: 'every month',
  weekly: 'every week',
};
