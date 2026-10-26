/** All tracking dates are UTC calendar days stored as `@db.Date`. */

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysAgo(n: number, from = new Date()): Date {
  const d = utcDay(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Inclusive list of date keys from `from` to `to`. */
export function dateKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  const d = utcDay(from);
  while (d <= to) {
    out.push(toDateKey(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export const RANGE_OPTIONS = [7, 28, 90, 180, 365] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(value: string | string[] | undefined, fallback: RangeDays = 28): RangeDays {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGE_OPTIONS as readonly number[]).includes(n) ? (n as RangeDays) : fallback;
}
