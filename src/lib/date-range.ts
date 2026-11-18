import { daysAgo, toDateKey, utcDay } from "@/lib/dates";

/** Ranges the date dialog offers on the Performance page (Search Console keeps 16 months). */
export const PERF_PRESETS = [1, 7, 28, 90, 180, 365, 486] as const;
/** The ranges every other page offers; they read synced data. */
export const BASIC_PRESETS = [7, 28, 90, 180, 365] as const;

export const PRESET_LABEL: Record<number, string> = {
  1: "Last 24 hours",
  7: "Last 7 days",
  28: "Last 28 days",
  90: "Last 3 months",
  180: "Last 6 months",
  365: "Last 12 months",
  486: "Last 16 months",
};

export type CompareKind = "none" | "previous" | "year" | "week" | "custom";
export type Window = { start: Date; end: Date };
export type CompareSpec = { kind: CompareKind; custom?: Window };

type Params = Record<string, string | string[] | undefined>;

const DAY_MS = 86_400_000;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
export const spanDays = (w: Window) => Math.round((w.end.getTime() - w.start.getTime()) / DAY_MS) + 1;

/** The oldest day Search Console can still report on: 16 months back. */
export function earliestDate(today = utcDay()): Date {
  const d = new Date(today);
  d.setUTCMonth(d.getUTCMonth() - 16);
  return d;
}

function parseDay(v: string | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || toDateKey(d) !== v ? null : d;
}

function validWindow(from: string | undefined, to: string | undefined): Window | null {
  const start = parseDay(from);
  const end = parseDay(to);
  if (!start || !end || start > end) return null;
  if (start < earliestDate() || end > utcDay()) return null;
  return { start, end };
}

/** The selected range from the URL: `?from=&to=` for a custom range, else `?days=` (a preset). */
export function resolveRange(sp: Params, fallbackDays = 90) {
  const custom = validWindow(first(sp.from), first(sp.to));
  if (custom) return { ...custom, days: spanDays(custom), custom: true };
  const n = Number(first(sp.days));
  const days = (PERF_PRESETS as readonly number[]).includes(n) ? n : fallbackDays;
  return { start: daysAgo(days - 1), end: daysAgo(0), days, custom: false };
}

export function resolveCompare(sp: Params, days: number): CompareSpec {
  const kind = first(sp.compare);
  if (kind === "previous" || kind === "year") return { kind };
  if (kind === "week" && days === 1) return { kind };
  if (kind === "custom") {
    const custom = validWindow(first(sp.cfrom), first(sp.cto));
    if (custom) return { kind, custom };
  }
  return { kind: "none" };
}

/** The dates the comparison covers. */
export function compareWindow(spec: CompareSpec, win: Window): Window | null {
  switch (spec.kind) {
    case "previous": {
      const end = addDays(win.start, -1);
      return { start: addDays(end, -(spanDays(win) - 1)), end };
    }
    case "year": {
      const shift = (d: Date) => {
        const out = new Date(d);
        out.setUTCFullYear(out.getUTCFullYear() - 1);
        return out;
      };
      return { start: shift(win.start), end: shift(win.end) };
    }
    case "week":
      return { start: addDays(win.start, -7), end: addDays(win.end, -7) };
    case "custom":
      return spec.custom ?? null;
    default:
      return null;
  }
}
