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

/** The first day of the week (Monday) or month a date key falls in. */
export function bucketStart(dateKey: string, by: "week" | "month"): string {
  if (by === "month") return `${dateKey.slice(0, 7)}-01`;
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return toDateKey(d);
}

/**
 * Daily points grouped into weeks or months: `sum` keys are added up, `mean` keys averaged over the days
 * that have a value. A key with no value on any day stays null. The first bucket can be a partial week or month.
 */
export function groupSeries<T extends { date: string }>(points: T[], by: "week" | "month", sum: (keyof T)[], mean: (keyof T)[]): T[] {
  const groups = new Map<string, T[]>();
  for (const p of points) {
    const k = bucketStart(p.date, by);
    groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  return [...groups].map(([date, ps]) => {
    const out = { ...ps[0], date } as T;
    const nums = (k: keyof T) => ps.map((p) => p[k]).filter((v): v is T[keyof T] & number => typeof v === "number");
    for (const k of sum) {
      const v = nums(k);
      out[k] = (v.length ? v.reduce((a, b) => a + b, 0) : null) as T[keyof T];
    }
    for (const k of mean) {
      const v = nums(k);
      out[k] = (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null) as T[keyof T];
    }
    return out;
  });
}
