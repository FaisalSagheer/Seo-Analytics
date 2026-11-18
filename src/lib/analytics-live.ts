import "server-only";
import { toDateKey } from "@/lib/dates";
import { addDays, type Window } from "@/lib/date-range";
import { getGoogleAccessToken } from "@/lib/providers";
import { ga4Breakdown, ga4Hourly, type Ga4BreakdownRow } from "@/lib/providers/google";
import type { Ga4Row, Ga4ReportData } from "@/components/performance/ga4-report";
import { formatHour } from "@/lib/format";

const HOUR_MS = 3_600_000;
const ZERO = { sessions: 0, users: 0, engagementRate: 0, conversions: 0 };
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function toRows(rows: Ga4BreakdownRow[], name: (key: string) => string = (k) => k, before?: Ga4BreakdownRow[]): Ga4Row[] {
  const prev = before ? new Map(before.map((r) => [r.key, r])) : null;
  return rows.map((r) => ({
    label: name(r.key),
    sessions: r.sessions,
    users: r.users,
    engagementRate: r.engagementRate,
    conversions: r.conversions,
    ...(prev ? { previous: prev.get(r.key) ?? ZERO } : {}),
  }));
}

export type AnalyticsHour = { date: string; sessions: number; users: number; engagementRate: number; conversions: number };
export type AnalyticsReport = {
  data: Ga4ReportData | null;
  /** Organic sessions per hour, oldest first, in the property's time zone; null outside the hourly view */
  hourly: AnalyticsHour[] | null;
  note?: string;
  hourlyError?: string;
};

/**
 * The Google Analytics reports for one range, read live: all channels, then organic landing pages,
 * countries and devices, and per-hour sessions for a short range. `compare` adds the change from another period.
 */
export async function loadAnalyticsReport(
  project: { id: string; userId: string; ga4PropertyId: string | null },
  opts: { window: Window; days: number; compare: Window | null; hourly: boolean },
): Promise<AnalyticsReport> {
  if (!project.ga4PropertyId) return { data: null, hourly: null, note: "Choose a GA4 property in project settings." };
  const id = project.ga4PropertyId;
  let token: string;
  try {
    token = await getGoogleAccessToken(project);
  } catch (err) {
    return { data: null, hourly: null, note: err instanceof Error ? err.message : "Couldn't connect to Google." };
  }

  // A 24 hour range covers yesterday and today, so the reports aren't just a few hours of one day
  const win = opts.days === 1 ? { start: addDays(opts.window.end, -1), end: opts.window.end } : opts.window;
  const run = (w: Window) =>
    Promise.all([
      ga4Breakdown(token, id, "sessionDefaultChannelGroup", toDateKey(w.start), toDateKey(w.end), false),
      ga4Breakdown(token, id, "landingPagePlusQueryString", toDateKey(w.start), toDateKey(w.end)),
      ga4Breakdown(token, id, "country", toDateKey(w.start), toDateKey(w.end)),
      ga4Breakdown(token, id, "deviceCategory", toDateKey(w.start), toDateKey(w.end)),
    ]);

  let data: Ga4ReportData | null = null;
  let note: string | undefined;
  try {
    const [[channels, pages, countries, devices], before] = await Promise.all([run(win), opts.compare ? run(opts.compare) : Promise.resolve(null)]);
    data = {
      channels: toRows(channels, undefined, before?.[0]),
      pages: toRows(pages, undefined, before?.[1]),
      countries: toRows(countries, undefined, before?.[2]),
      devices: toRows(devices, title, before?.[3]),
    };
  } catch (err) {
    note = `Couldn't load Google Analytics: ${err instanceof Error ? err.message : "unknown error"}`;
  }

  let hourly: AnalyticsHour[] | null = null;
  let hourlyError: string | undefined;
  if (opts.hourly) {
    try {
      const rows = await ga4Hourly(token, id, toDateKey(win.start), toDateKey(win.end));
      const last = rows.length ? new Date(rows[rows.length - 1].time).getTime() : 0;
      // GA4 leaves out hours with no sessions; fill them in as zero so the chart and table have no gaps
      const first = opts.days === 1 ? last - 23 * HOUR_MS : rows.length ? new Date(rows[0].time).getTime() : 0;
      const byTime = new Map(rows.map((r) => [new Date(r.time).getTime(), r]));
      hourly = [];
      for (let t = first; rows.length && t <= last; t += HOUR_MS) {
        const r = byTime.get(t);
        hourly.push({ date: new Date(t).toISOString(), sessions: r?.sessions ?? 0, users: r?.users ?? 0, engagementRate: r?.engagementRate ?? 0, conversions: r?.conversions ?? 0 });
      }
    } catch (err) {
      hourlyError = err instanceof Error ? err.message : "Couldn't read hourly Google Analytics data";
    }
  }
  return { data, hourly, note, hourlyError };
}

/** An hourly point as a report row, newest first when listed. */
export const hourRow = (h: AnalyticsHour): Ga4Row => ({
  label: formatHour(h.date),
  sessions: h.sessions,
  users: h.users,
  engagementRate: h.engagementRate,
  conversions: h.conversions,
});
