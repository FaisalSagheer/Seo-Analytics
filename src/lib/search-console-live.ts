import "server-only";
import { daysAgo, toDateKey } from "@/lib/dates";
import { getGoogleAccessToken } from "@/lib/providers";
import { gscDaily, gscHourly } from "@/lib/providers/google";

export type Compare = "none" | "previous" | "year";
export type Totals = { clicks: number; impressions: number; ctr: number; position: number };
export type HourPoint = { date: string; clicks: number; impressions: number };

export type LiveReport = {
  /** Hour-by-hour points for the chart, or null when the range is shown by day */
  hourly: HourPoint[] | null;
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

const shiftYear = (d: Date) => {
  const out = new Date(d);
  out.setUTCFullYear(out.getUTCFullYear() - 1);
  return out;
};

/**
 * What the Performance page reads live from Search Console: hourly points for a
 * short range, and totals for the selected and comparison ranges.
 */
export async function loadLiveReport(
  project: { id: string; userId: string; gscSiteUrl: string | null },
  opts: { days: number; hourly: boolean; compare: Compare },
): Promise<LiveReport> {
  const empty: LiveReport = { hourly: null, current: null, previous: null, lastDataAt: null };
  if (!project.gscSiteUrl || (!opts.hourly && opts.compare === "none")) return empty;
  const site = project.gscSiteUrl;
  try {
    const token = await getGoogleAccessToken(project);
    const { days } = opts;
    const today = daysAgo(0);
    const curStart = daysAgo(days - 1);
    const prevEnd = daysAgo(days);
    const prevStart = daysAgo(days === 1 ? 1 : 2 * days - 1);
    const dailyTotals = async (from: Date, to: Date) => sumTotals(await gscDaily(token, site, toDateKey(from), toDateKey(to)));

    let hourly: HourPoint[] | null = null;
    let current: Totals | null = null;
    let previous: Totals | null = null;
    let lastDataAt: Date | null = null;

    if (opts.hourly) {
      const rows = await gscHourly(token, site, toDateKey(daysAgo(days === 1 ? 1 : days - 1)), toDateKey(today));
      // A 24 hour range is the latest 24 hours, which straddles two calendar days
      const cur = days === 1 ? rows.slice(-24) : rows;
      hourly = cur.map((r) => ({ date: r.time, clicks: r.clicks, impressions: r.impressions }));
      current = sumTotals(cur);
      lastDataAt = cur.length ? new Date(cur[cur.length - 1].time) : null;
      if (opts.compare === "previous" && days === 1) previous = sumTotals(rows.slice(-48, -24));
    }

    if (opts.compare === "previous" && previous == null) {
      const [cur, prev] = await Promise.all([current ? null : dailyTotals(curStart, today), dailyTotals(prevStart, prevEnd)]);
      current ??= cur;
      previous = prev;
    } else if (opts.compare === "year") {
      const [cur, prev] = await Promise.all([current ? null : dailyTotals(curStart, today), dailyTotals(shiftYear(curStart), shiftYear(today))]);
      current ??= cur;
      previous = prev;
    }
    return { hourly, current, previous, lastDataAt };
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Couldn't read Search Console" };
  }
}
