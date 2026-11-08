/**
 * Simulated clock helpers. Domain logic never reads the real time:
 * every rule receives `today` as an ISO date (YYYY-MM-DD) so the presenter
 * can time-travel during demos.
 */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;

export function parseIsoDate(iso: IsoDate): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`Invalid ISO date: ${iso}`);
  return t;
}

export function formatIsoDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return formatIsoDate(parseIsoDate(iso) + days * MS_PER_DAY);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / MS_PER_DAY);
}

export function daysLeft(expiry: IsoDate, today: IsoDate): number {
  return daysBetween(today, expiry);
}
