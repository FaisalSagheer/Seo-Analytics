import "server-only";
import { toDateKey } from "@/lib/dates";
import { compareWindow, type CompareSpec, type Window } from "@/lib/date-range";
import { getGoogleAccessToken } from "@/lib/providers";
import { gscDaily, gscHourly } from "@/lib/providers/google";

export type Totals = { clicks: number; impressions: number; ctr: number; position: number };
export type HourPoint = { date: string; clicks: number; impressions: number };
export type DayPoint = { date: string; clicks: number; impressions: number };

export type LiveReport = {
  /** Hour-by-hour points for the chart, or null when the range is shown by day */
  hourly: HourPoint[] | null;
  /** Day-by-day points when the page asked for them (ranges beyond the synced window) */
  daily: DayPoint[] | null;
  /** Totals for the selected range straight from Search Console; null when the page should use its synced numbers */
  current: Totals | null;
  /** Totals for the comparison range; null when not comparing */
  previous: Totals | null;
  /** When Search Console last had data for the range (hourly mode only) */
  lastDataAt: Date | null;
  error?: string;
};

/** Search Console keeps hourly data for about 10 days; stay well inside that. */
export const MAX_HOURLY_DAYS = 7;

type Row = { clicks: number; impressions: number; position: number };

/** Impression-weighted position, as Search Console reports it. */
export function sumTotals(rows: Row[]): Totals | null {
  if (rows.length === 0) return null;
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weighted += r.position * r.impressions;
  }
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: impressions ? weighted / impressions : 0 };
}

const HOUR_MS = 3_600_000;

/**
 * What the Performance page reads live from Search Console: hourly points for a
 * short range, day points for a long one, and totals for the selected and comparison ranges.
 */
export async function loadLiveReport(
  project: { id: string; userId: string; gscSiteUrl: string | null },
  opts: { window: Window; days: number; hourly: boolean; compare: CompareSpec; wantDaily: boolean },
): Promise<LiveReport> {
  const empty: LiveReport = { hourly: null, daily: null, current: null, previous: null, lastDataAt: null };
  const { window: win, days, compare } = opts;
  if (!project.gscSiteUrl || (!opts.hourly && !opts.wantDaily && compare.kind === "none")) return empty;
  const site = project.gscSiteUrl;
  try {
    const token = await getGoogleAccessToken(project);
    const dailyRows = (w: Window) => gscDaily(token, site, toDateKey(w.start), toDateKey(w.end));

    let hourly: HourPoint[] | null = null;
    let daily: DayPoint[] | null = null;
    let current: Totals | null = null;
    let previous: Totals | null = null;
    let lastDataAt: Date | null = null;

    if (opts.hourly) {
      // A 24 hour range is the latest 24 hours, which straddles two calendar days; week over week needs a week more
      const from = days === 1 ? new Date(win.end.getTime() - (compare.kind === "week" ? 8 : 1) * 86_400_000) : win.start;
      const rows = await gscHourly(token, site, toDateKey(from), toDateKey(win.end));
      const cur = days === 1 ? rows.slice(-24) : rows;
      hourly = cur.map((r) => ({ date: r.time, clicks: r.clicks, impressions: r.impressions }));
      current = sumTotals(cur);
      lastDataAt = cur.length ? new Date(cur[cur.length - 1].time) : null;
      if (days === 1 && cur.length) {
        const last = new Date(cur[cur.length - 1].time).getTime();
        if (compare.kind === "previous") previous = sumTotals(rows.slice(-48, -24));
        if (compare.kind === "week") {
          const end = last - 7 * 86_400_000;
          previous = sumTotals(rows.filter((r) => new Date(r.time).getTime() > end - 24 * HOUR_MS && new Date(r.time).getTime() <= end));
        }
      }
    } else if (opts.wantDaily || compare.kind !== "none") {
      const rows = await dailyRows(win);
      current = sumTotals(rows);
      if (opts.wantDaily) daily = rows.map((r) => ({ date: r.date, clicks: r.clicks, impressions: r.impressions }));
    }

    const cmp = compareWindow(compare, win);
    if (cmp && previous == null) previous = sumTotals(await dailyRows(cmp));
    return { hourly, daily, current, previous, lastDataAt };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Couldn't read Search Console" };
  }
}
