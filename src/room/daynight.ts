export type TimeOfDay = 'day' | 'night';

export function hourInTz(tz: string, date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour');
  return hour ? Number(hour.value) : 12;
}

export function isDaylight(tz: string, date: Date = new Date()): boolean {
  const hour = hourInTz(tz, date);
  return hour >= 7 && hour < 19;
}

/**
 * Resolve the room's day/night state. `auto` follows the reference timezone's
 * daylight hours; `day`/`night` are manual overrides.
 */
export function resolveTimeOfDay(
  mode: 'auto' | 'day' | 'night',
  referenceTz: string,
  date: Date = new Date(),
): TimeOfDay {
  if (mode === 'day') return 'day';
  if (mode === 'night') return 'night';
  return isDaylight(referenceTz, date) ? 'day' : 'night';
}
