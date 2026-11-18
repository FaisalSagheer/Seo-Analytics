import "server-only";
import type { Ga4DailyRow, GscDailyRow, GscQueryRow } from "@/lib/types";

export const GOOGLE_DATA_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

async function call<T>(token: string, url: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new GoogleApiError(err?.error?.message ?? `Google API ${res.status}`, res.status);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Search Console ----

export async function listGscSites(token: string) {
  const r = await call<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(
    token,
    "https://www.googleapis.com/webmasters/v3/sites",
  );
  return (r.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
}

type GscRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

function gscUrl(siteUrl: string) {
  return `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
}

export async function gscDaily(token: string, siteUrl: string, startDate: string, endDate: string): Promise<GscDailyRow[]> {
  const r = await call<{ rows?: GscRow[] }>(token, gscUrl(siteUrl), {
    startDate,
    endDate,
    dimensions: ["date"],
    type: "web",
    rowLimit: 25_000,
    dataState: "all",
  });
  return (r.rows ?? []).map((row) => ({
    date: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

export type GscHourRow = { time: string; clicks: number; impressions: number; ctr: number; position: number };

/** Hour-by-hour totals. Search Console keeps hourly data for only the last few days, so keep the window short. */
export async function gscHourly(token: string, siteUrl: string, startDate: string, endDate: string): Promise<GscHourRow[]> {
  const r = await call<{ rows?: GscRow[] }>(token, gscUrl(siteUrl), {
    startDate,
    endDate,
    dimensions: ["hour"],
    type: "web",
    dataState: "hourly_all",
    rowLimit: 25_000,
  });
  return (r.rows ?? [])
    .map((row) => ({ time: new Date(row.keys[0]).toISOString(), clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function gscQueries(token: string, siteUrl: string, startDate: string, endDate: string): Promise<GscQueryRow[]> {
  const r = await call<{ rows?: GscRow[] }>(token, gscUrl(siteUrl), {
    startDate,
    endDate,
    dimensions: ["query"],
    type: "web",
    rowLimit: 1000,
  });
  return (r.rows ?? []).map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

export type GscBreakdownDimension = "page" | "country" | "device" | "searchAppearance";
export type GscBreakdownRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };

/** One Search Console report tab (Pages, Countries, Devices, Search appearance), most clicks first. */
export async function gscBreakdown(
  token: string,
  siteUrl: string,
  dimension: GscBreakdownDimension,
  startDate: string,
  endDate: string,
  rowLimit = 250,
): Promise<GscBreakdownRow[]> {
  const r = await call<{ rows?: GscRow[] }>(token, gscUrl(siteUrl), {
    startDate,
    endDate,
    dimensions: [dimension],
    type: "web",
    rowLimit,
  });
  return (r.rows ?? []).map((row) => ({ key: row.keys[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }));
}

export type GscKeywordFilters = { device?: "DESKTOP" | "MOBILE"; country?: string };
export type GscKeywordHistory = {
  /** Average position per day (impression-weighted across pages), YYYY-MM-DD */
  days: { date: string; position: number }[];
  /** The page that got the most impressions for the query */
  url: string | null;
};

/**
 * Position history for one exact query. Search Console reports the average
 * position of the site's results for that query, so a day exists only when the
 * site was shown at least once that day.
 */
export async function gscKeywordHistory(
  token: string,
  siteUrl: string,
  phrase: string,
  startDate: string,
  endDate: string,
  filters: GscKeywordFilters = {},
): Promise<GscKeywordHistory> {
  const dimensionFilters = [
    { dimension: "query", operator: "equals", expression: phrase.trim().toLowerCase() },
    ...(filters.device ? [{ dimension: "device", operator: "equals", expression: filters.device }] : []),
    ...(filters.country ? [{ dimension: "country", operator: "equals", expression: filters.country }] : []),
  ];
  const r = await call<{ rows?: GscRow[] }>(token, gscUrl(siteUrl), {
    startDate,
    endDate,
    dimensions: ["date", "page"],
    type: "web",
    dimensionFilterGroups: [{ groupType: "and", filters: dimensionFilters }],
    rowLimit: 25_000,
    dataState: "all",
  });
  const byDate = new Map<string, { weighted: number; impressions: number }>();
  const byPage = new Map<string, number>();
  for (const row of r.rows ?? []) {
    const [date, page] = row.keys;
    const d = byDate.get(date) ?? { weighted: 0, impressions: 0 };
    d.weighted += row.position * row.impressions;
    d.impressions += row.impressions;
    byDate.set(date, d);
    byPage.set(page, (byPage.get(page) ?? 0) + row.impressions);
  }
  const days = [...byDate]
    .filter(([, v]) => v.impressions > 0)
    .map(([date, v]) => ({ date, position: Math.max(1, Math.round(v.weighted / v.impressions)) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const url = [...byPage].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { days, url };
}

// ---- GA4 ----

export async function listGa4Properties(token: string) {
  type R = {
    accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[];
  };
  const r = await call<R>(token, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
  return (r.accountSummaries ?? []).flatMap((a) =>
    (a.propertySummaries ?? []).map((p) => ({
      id: p.property.replace("properties/", ""),
      name: `${p.displayName} (${a.displayName})`,
    })),
  );
}

export async function ga4Daily(token: string, propertyId: string, startDate: string, endDate: string): Promise<Ga4DailyRow[]> {
  type R = { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] };
  const r = await call<R>(token, `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }, { name: "engagementRate" }],
    // Organic search only, so the numbers line up with rankings and GSC
    dimensionFilter: {
      filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } },
    },
    limit: 10_000,
  });
  return (r.rows ?? []).map((row) => {
    const d = row.dimensionValues[0].value; // YYYYMMDD
    return {
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      sessions: Number(row.metricValues[0].value),
      users: Number(row.metricValues[1].value),
      conversions: Math.round(Number(row.metricValues[2].value)),
      engagementRate: Number(row.metricValues[3].value),
    };
  });
}

export type Ga4HourRow = { time: string; sessions: number; users: number };

/**
 * Organic sessions per hour. GA4 reports hours in the property's own time zone; the values are
 * returned as if that clock were UTC, so a chart shows the property's local hours.
 */
export async function ga4Hourly(token: string, propertyId: string, startDate: string, endDate: string): Promise<Ga4HourRow[]> {
  const r = await call<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>(
    token,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "dateHour" }], // YYYYMMDDHH
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      limit: 10_000,
    },
  );
  return (r.rows ?? [])
    .map((row) => {
      const v = row.dimensionValues[0].value;
      return { time: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:00:00.000Z`, sessions: Number(row.metricValues[0].value), users: Number(row.metricValues[1].value) };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
}

export type Ga4Dimension = "sessionDefaultChannelGroup" | "landingPagePlusQueryString" | "country" | "deviceCategory";
export type Ga4BreakdownRow = { key: string; sessions: number; users: number; engagementRate: number; conversions: number };

/** One Google Analytics report: sessions, users, engagement and key events per value of a dimension, busiest first. */
export async function ga4Breakdown(
  token: string,
  propertyId: string,
  dimension: Ga4Dimension,
  startDate: string,
  endDate: string,
  organicOnly = true,
  limit = 250,
): Promise<Ga4BreakdownRow[]> {
  const r = await call<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>(
    token,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: dimension }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagementRate" }, { name: "keyEvents" }],
      ...(organicOnly
        ? { dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } } }
        : {}),
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit,
    },
  );
  return (r.rows ?? []).map((row) => ({
    key: row.dimensionValues[0].value,
    sessions: Number(row.metricValues[0].value),
    users: Number(row.metricValues[1].value),
    engagementRate: Number(row.metricValues[2].value),
    conversions: Math.round(Number(row.metricValues[3].value)),
  }));
}

// ---- GA4 referrals: the closest free thing to backlink tracking ----

export type Ga4ReferralDay = { date: string; source: string; sessions: number; users: number; conversions: number };
export type Ga4ReferralPage = { referrer: string; source: string; sessions: number; users: number };

const REFERRAL_ONLY = {
  filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Referral" } },
};
const NOT_A_SITE = new Set(["(not set)", "(direct)", "(none)", ""]);

type RunReport = { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] };
const reportUrl = (propertyId: string) => `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;

/** Sessions from other websites, per day and site. Only links that sent at least one visit appear. */
export async function ga4ReferralDaily(token: string, propertyId: string, startDate: string, endDate: string): Promise<Ga4ReferralDay[]> {
  const r = await call<RunReport>(token, reportUrl(propertyId), {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }, { name: "sessionSource" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }],
    dimensionFilter: REFERRAL_ONLY,
    limit: 100_000,
  });
  // GA4 can list "Example.com" and "example.com" separately; once lowercased they are one site, so merge
  // them (a day + site pair must be unique when stored)
  const merged = new Map<string, Ga4ReferralDay>();
  for (const row of r.rows ?? []) {
    const source = row.dimensionValues[1].value.trim().toLowerCase().slice(0, 191);
    if (NOT_A_SITE.has(source)) continue;
    const d = row.dimensionValues[0].value; // YYYYMMDD
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const key = `${date}|${source}`;
    const entry = merged.get(key) ?? { date, source, sessions: 0, users: 0, conversions: 0 };
    entry.sessions += Number(row.metricValues[0].value);
    entry.users += Number(row.metricValues[1].value);
    entry.conversions += Math.round(Number(row.metricValues[2].value));
    merged.set(key, entry);
  }
  return [...merged.values()];
}

/** The individual pages that sent visits, busiest first. */
export async function ga4ReferralPages(token: string, propertyId: string, startDate: string, endDate: string): Promise<Ga4ReferralPage[]> {
  const r = await call<RunReport>(token, reportUrl(propertyId), {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pageReferrer" }],
    metrics: [{ name: "sessions" }, { name: "totalUsers" }],
    dimensionFilter: REFERRAL_ONLY,
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 1000,
  });
  const out: Ga4ReferralPage[] = [];
  for (const row of r.rows ?? []) {
    const referrer = row.dimensionValues[0].value.trim();
    let host: string;
    try {
      host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      continue; // "(not set)" and other values that aren't a URL
    }
    if (!host) continue;
    out.push({ referrer: referrer.slice(0, 2048), source: host.slice(0, 191), sessions: Number(row.metricValues[0].value), users: Number(row.metricValues[1].value) });
  }
  return out;
}
