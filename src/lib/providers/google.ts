import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type { Ga4DailyRow, GscDailyRow, GscQueryRow } from "@/lib/types";

export const GOOGLE_DATA_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];

/**
 * Merchant Center (Shopping). Kept apart from GOOGLE_DATA_SCOPES: connections made before it
 * existed don't carry it, and they must keep working for Search Console and GA4.
 */
export const MERCHANT_SCOPE = "https://www.googleapis.com/auth/content";

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

/** How long a Google answer is reused. Reports and rank re-syncs repeat the same requests; this keeps API quota in check. */
const CACHE_SECONDS = 5 * 60;

/**
 * The cache key includes the access token, so an answer is only ever reused for the same Google
 * access that fetched it: another project, or another key, can never read it. Only the hash is stored.
 */
function cacheKey(token: string, url: string, body: unknown) {
  return createHash("sha256").update(`${token}\u0000${url}\u0000${body === undefined ? "" : JSON.stringify(body)}`).digest("hex");
}

async function call<T>(token: string, url: string, body?: unknown): Promise<T> {
  const key = cacheKey(token, url, body);
  // A cache problem must never break a report: on any error, just ask Google
  try {
    const hit = await db.providerCache.findUnique({ where: { key } });
    if (hit && hit.expiresAt > new Date()) return hit.payload as T;
  } catch {}
  const data = await fetchGoogle<T>(token, url, body);
  try {
    const expiresAt = new Date(Date.now() + CACHE_SECONDS * 1000);
    await db.providerCache.upsert({ where: { key }, create: { key, payload: data as object, expiresAt }, update: { payload: data as object, expiresAt } });
    // Now and then, drop answers that expired a while ago
    if (Math.random() < 0.02) await db.providerCache.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } } });
  } catch {}
  return data;
}

export async function fetchGoogle<T>(token: string, url: string, body?: unknown, method?: "GET" | "POST" | "PATCH" | "DELETE"): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new GoogleApiError(err?.error?.message ?? `Google API ${res.status}`, res.status);
    }
    // DELETE answers with an empty body
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
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
export type GscKeywordPageDay = { date: string; page: string; position: number; impressions: number; clicks: number };

export type GscKeywordHistory = {
  /** Average position per day (impression-weighted across pages), YYYY-MM-DD, with that day's top page */
  days: { date: string; position: number; url: string | null }[];
  /** The page that got the most impressions for the query over the whole window */
  url: string | null;
  /** Every page that showed for the query, per day */
  pages: GscKeywordPageDay[];
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
  const byDate = new Map<string, { weighted: number; impressions: number; top: { page: string; impressions: number; position: number } | null }>();
  const byPage = new Map<string, number>();
  const pages: GscKeywordPageDay[] = [];
  for (const row of r.rows ?? []) {
    const [date, page] = row.keys;
    const d = byDate.get(date) ?? { weighted: 0, impressions: 0, top: null };
    d.weighted += row.position * row.impressions;
    d.impressions += row.impressions;
    // The day's ranking page: most impressions, and on a tie the better position
    if (!d.top || row.impressions > d.top.impressions || (row.impressions === d.top.impressions && row.position < d.top.position)) {
      d.top = { page, impressions: row.impressions, position: row.position };
    }
    byDate.set(date, d);
    byPage.set(page, (byPage.get(page) ?? 0) + row.impressions);
    pages.push({ date, page, position: row.position, impressions: row.impressions, clicks: row.clicks });
  }
  const days = [...byDate]
    .filter(([, v]) => v.impressions > 0)
    .map(([date, v]) => ({ date, position: Math.max(1, Math.round(v.weighted / v.impressions)), url: v.top?.page ?? null }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const url = [...byPage].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { days, url, pages };
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

export type Ga4HourRow = { time: string; sessions: number; users: number; engagementRate: number; conversions: number };

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
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "engagementRate" }, { name: "keyEvents" }],
      dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", stringFilter: { matchType: "EXACT", value: "Organic Search" } } },
      limit: 10_000,
    },
  );
  return (r.rows ?? [])
    .map((row) => {
      const v = row.dimensionValues[0].value;
      return { time: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(8, 10)}:00:00.000Z`, sessions: Number(row.metricValues[0].value),
        users: Number(row.metricValues[1].value),
        engagementRate: Number(row.metricValues[2].value),
        conversions: Math.round(Number(row.metricValues[3].value)),
      };
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

// ---- URL Inspection (Search Console) ----

export type UrlInspection = {
  /** PASS (on Google), NEUTRAL (excluded) or FAIL (error) */
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  crawledAs: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  sitemaps: string[];
  referringUrls: string[];
  mobile: { verdict: string; issues: string[] } | null;
  richResults: { verdict: string; items: { type: string; issues: string[] }[] } | null;
  /** The same inspection in Search Console */
  link: string | null;
};

type InspectResponse = {
  inspectionResult?: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: string;
      coverageState?: string;
      indexingState?: string;
      robotsTxtState?: string;
      pageFetchState?: string;
      lastCrawlTime?: string;
      crawledAs?: string;
      googleCanonical?: string;
      userCanonical?: string;
      sitemap?: string[];
      referringUrls?: string[];
    };
    mobileUsabilityResult?: { verdict?: string; issues?: { message?: string; issueType?: string }[] };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: { richResultType?: string; items?: { issues?: { issueMessage?: string }[] }[] }[];
    };
  };
};

/** Google's view of one URL: index status, last crawl, canonicals, mobile usability and rich results. */
export async function gscInspectUrl(token: string, siteUrl: string, inspectionUrl: string): Promise<UrlInspection> {
  const r = await call<InspectResponse>(token, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    inspectionUrl,
    siteUrl,
    languageCode: "en-US",
  });
  const res = r.inspectionResult ?? {};
  const idx = res.indexStatusResult ?? {};
  const mob = res.mobileUsabilityResult;
  const rich = res.richResultsResult;
  return {
    verdict: idx.verdict ?? null,
    coverageState: idx.coverageState ?? null,
    indexingState: idx.indexingState ?? null,
    robotsTxtState: idx.robotsTxtState ?? null,
    pageFetchState: idx.pageFetchState ?? null,
    lastCrawlTime: idx.lastCrawlTime ?? null,
    crawledAs: idx.crawledAs ?? null,
    googleCanonical: idx.googleCanonical ?? null,
    userCanonical: idx.userCanonical ?? null,
    sitemaps: (idx.sitemap ?? []).slice(0, 10),
    referringUrls: (idx.referringUrls ?? []).slice(0, 10),
    mobile: mob?.verdict ? { verdict: mob.verdict, issues: (mob.issues ?? []).map((i) => i.message ?? i.issueType ?? "").filter(Boolean) } : null,
    richResults: rich?.verdict
      ? {
          verdict: rich.verdict,
          items: (rich.detectedItems ?? []).map((d) => ({
            type: d.richResultType ?? "Rich result",
            issues: (d.items ?? []).flatMap((i) => (i.issues ?? []).map((x) => x.issueMessage ?? "")).filter(Boolean),
          })),
        }
      : null,
    link: res.inspectionResultLink && /^https:\/\//.test(res.inspectionResultLink) ? res.inspectionResultLink : null,
  };
}

// ---- Merchant Center (Merchant API v1) ----

const MERCHANT_API = "https://merchantapi.googleapis.com";

export type MerchantAccount = { id: string; name: string };

/** Merchant Center accounts this Google access can see. */
export async function listMerchantAccounts(token: string): Promise<MerchantAccount[]> {
  const r = await call<{ accounts?: { accountId?: string; accountName?: string }[] }>(token, `${MERCHANT_API}/accounts/v1/accounts?pageSize=250`);
  return (r.accounts ?? [])
    .filter((a): a is { accountId: string; accountName?: string } => Boolean(a.accountId))
    .map((a) => ({ id: a.accountId, name: a.accountName || a.accountId }));
}

type ReportRow = {
  productPerformanceView?: {
    date?: { year: number; month: number; day: number };
    marketingMethod?: string;
    offerId?: string;
    title?: string;
    clicks?: string;
    impressions?: string;
    conversions?: number;
  };
};

/** Runs a Merchant Center Query Language report, following pages up to a cap. */
async function merchantReport(token: string, accountId: string, query: string, maxPages = 10): Promise<ReportRow[]> {
  const rows: ReportRow[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const r = await call<{ results?: ReportRow[]; nextPageToken?: string }>(token, `${MERCHANT_API}/reports/v1/accounts/${accountId}/reports:search`, {
      query,
      pageSize: 5000,
      ...(pageToken ? { pageToken } : {}),
    });
    rows.push(...(r.results ?? []));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return rows;
}

export type MarketingMethod = "ORGANIC" | "ADS" | "AFFILIATE" | "OTHER";
const asMethod = (m: string | undefined): MarketingMethod => (m === "ORGANIC" || m === "ADS" || m === "AFFILIATE" ? m : "OTHER");
const dateKey = (d?: { year: number; month: number; day: number }) =>
  d ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "";

export type ShoppingDay = { date: string; method: MarketingMethod; clicks: number; impressions: number; conversions: number };
export type ShoppingProductRow = { offerId: string; title: string; method: MarketingMethod; clicks: number; impressions: number; conversions: number };

/** Dates are YYYY-MM-DD and already validated (src/lib/date-range.ts), so they are safe inside the query. */
export const shoppingDailyQuery = (start: string, end: string) =>
  `SELECT date, marketing_method, clicks, impressions, conversions FROM product_performance_view WHERE date BETWEEN '${start}' AND '${end}'`;
export const shoppingProductsQuery = (start: string, end: string) =>
  `SELECT offer_id, title, marketing_method, clicks, impressions, conversions FROM product_performance_view WHERE date BETWEEN '${start}' AND '${end}'`;

/** Clicks, impressions and conversions per day and marketing method (free listings, ads, affiliate). */
export async function merchantDaily(token: string, accountId: string, start: string, end: string): Promise<ShoppingDay[]> {
  const rows = await merchantReport(token, accountId, shoppingDailyQuery(start, end));
  return rows
    .map((r) => r.productPerformanceView)
    .filter((v): v is NonNullable<typeof v> => Boolean(v?.date))
    .map((v) => ({
      date: dateKey(v.date),
      method: asMethod(v.marketingMethod),
      clicks: Number(v.clicks ?? 0),
      impressions: Number(v.impressions ?? 0),
      conversions: Number(v.conversions ?? 0),
    }));
}

/** The same metrics per product for the range. */
export async function merchantProductPerformance(token: string, accountId: string, start: string, end: string): Promise<ShoppingProductRow[]> {
  const rows = await merchantReport(token, accountId, shoppingProductsQuery(start, end), 5);
  return rows
    .map((r) => r.productPerformanceView)
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .map((v) => ({
      offerId: v.offerId ?? "",
      title: v.title ?? v.offerId ?? "",
      method: asMethod(v.marketingMethod),
      clicks: Number(v.clicks ?? 0),
      impressions: Number(v.impressions ?? 0),
      conversions: Number(v.conversions ?? 0),
    }));
}

export type ProductHealthStatus = "APPROVED" | "LIMITED" | "PENDING" | "DISAPPROVED";
export type ProductIssue = {
  code: string;
  description: string;
  detail: string | null;
  severity: "DISAPPROVED" | "DEMOTED" | "NOT_IMPACTED";
  attribute: string | null;
  documentation: string | null;
};
export type MerchantProduct = {
  /** accounts/{id}/products/{lang~label~offer} */
  name: string;
  /** The primary data source the product comes from */
  dataSource: string | null;
  offerId: string;
  title: string;
  link: string | null;
  imageLink: string | null;
  availability: string | null;
  status: ProductHealthStatus;
  issues: ProductIssue[];
};

type ApiProduct = {
  name?: string;
  dataSource?: string;
  offerId?: string;
  contentLanguage?: string;
  feedLabel?: string;
  productAttributes?: { title?: string; link?: string; imageLink?: string; availability?: string; [k: string]: unknown };
  productStatus?: {
    destinationStatuses?: { reportingContext?: string; approvedCountries?: string[]; pendingCountries?: string[]; disapprovedCountries?: string[] }[];
    itemLevelIssues?: { code?: string; description?: string; detail?: string; severity?: string; attribute?: string; documentation?: string }[];
  };
};

const SEVERITY_RANK: Record<ProductIssue["severity"], number> = { DISAPPROVED: 0, DEMOTED: 1, NOT_IMPACTED: 2 };

/**
 * A product's status across its destinations: approved somewhere and nothing limiting it,
 * approved but disapproved or demoted somewhere (limited), only pending, or disapproved everywhere.
 */
export function productHealth(p: ApiProduct): { status: ProductHealthStatus; issues: ProductIssue[] } {
  const dests = p.productStatus?.destinationStatuses ?? [];
  const approved = dests.some((d) => (d.approvedCountries ?? []).length > 0);
  const pending = dests.some((d) => (d.pendingCountries ?? []).length > 0);
  const disapproved = dests.some((d) => (d.disapprovedCountries ?? []).length > 0);
  // One entry per issue code; the same issue is repeated for each destination it affects
  const byCode = new Map<string, ProductIssue>();
  for (const i of p.productStatus?.itemLevelIssues ?? []) {
    const severity = i.severity === "DISAPPROVED" || i.severity === "DEMOTED" ? i.severity : "NOT_IMPACTED";
    const code = i.code ?? i.description ?? "issue";
    const prev = byCode.get(code);
    if (prev && SEVERITY_RANK[prev.severity] <= SEVERITY_RANK[severity]) continue;
    byCode.set(code, {
      code,
      description: i.description ?? code,
      detail: i.detail ?? null,
      severity,
      attribute: i.attribute ?? null,
      documentation: i.documentation && /^https:\/\//.test(i.documentation) ? i.documentation : null,
    });
  }
  const issues = [...byCode.values()].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  const limiting = issues.some((i) => i.severity !== "NOT_IMPACTED");
  const status: ProductHealthStatus = approved
    ? disapproved || limiting
      ? "LIMITED"
      : "APPROVED"
    : pending && !disapproved
      ? "PENDING"
      : "DISAPPROVED";
  return { status, issues };
}

/** Processed products with their status and issues, up to `maxPages` × 1000 products. */
export async function listMerchantProducts(token: string, accountId: string, maxPages = 5): Promise<{ products: MerchantProduct[]; truncated: boolean }> {
  const products: MerchantProduct[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const url = `${MERCHANT_API}/products/v1/accounts/${accountId}/products?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const r = await call<{ products?: ApiProduct[]; nextPageToken?: string }>(token, url);
    for (const p of r.products ?? []) {
      const { status, issues } = productHealth(p);
      const link = p.productAttributes?.link;
      const image = p.productAttributes?.imageLink;
      products.push({
        name: p.name ?? "",
        dataSource: p.dataSource ?? null,
        offerId: p.offerId ?? "",
        title: p.productAttributes?.title ?? p.offerId ?? "",
        link: link && /^https?:\/\//i.test(link) ? link : null,
        imageLink: image && /^https:\/\//i.test(image) ? image : null,
        availability: p.productAttributes?.availability ?? null,
        status,
        issues,
      });
    }
    pageToken = r.nextPageToken;
    if (!pageToken) return { products, truncated: false };
  }
  return { products, truncated: true };
}

/**
 * Registers this app's Google Cloud project with a Merchant Center account, which Google asks for
 * before the Merchant API answers. Needs Admin access to the account. Never cached.
 */
export async function registerMerchantGcp(token: string, accountId: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/accounts/v1/accounts/${accountId}/developerRegistration:registerGcp`, {});
}

// ---- Merchant Center: shipping, regions, return policies, account issues ----
// Reads for editing are uncached (fetchGoogle), so a save never starts from a stale copy.

type ShippingDoc = import("@/lib/merchant-shipping").ShippingSettings;
type RegionDoc = import("@/lib/merchant-shipping").Region;
type ReturnPolicyDoc = import("@/lib/merchant-shipping").ReturnPolicy;

const acct = (accountId: string) => `${MERCHANT_API}/accounts/v1/accounts/${accountId}`;

/** The account's shipping settings; an account that never set any gets an empty document with an empty etag. */
export async function getShippingSettings(token: string, accountId: string): Promise<ShippingDoc> {
  try {
    return await fetchGoogle<ShippingDoc>(token, `${acct(accountId)}/shippingSettings`);
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 404) return { services: [], warehouses: [], etag: "" };
    throw err;
  }
}

/** Replaces the whole shipping settings document; `etag` must be the one last read. */
export function insertShippingSettings(token: string, accountId: string, settings: ShippingDoc): Promise<ShippingDoc> {
  return fetchGoogle<ShippingDoc>(token, `${acct(accountId)}/shippingSettings:insert`, settings);
}

export async function listRegions(token: string, accountId: string): Promise<RegionDoc[]> {
  const out: RegionDoc[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await fetchGoogle<{ regions?: RegionDoc[]; nextPageToken?: string }>(
      token,
      `${acct(accountId)}/regions?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
    );
    out.push(...(r.regions ?? []));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export function createRegion(token: string, accountId: string, regionId: string, region: RegionDoc): Promise<RegionDoc> {
  return fetchGoogle<RegionDoc>(token, `${acct(accountId)}/regions?regionId=${encodeURIComponent(regionId)}`, region);
}

export function updateRegion(token: string, regionName: string, region: RegionDoc, updateMask: string[]): Promise<RegionDoc> {
  return fetchGoogle<RegionDoc>(token, `${MERCHANT_API}/accounts/v1/${regionName}?updateMask=${encodeURIComponent(updateMask.join(","))}`, region, "PATCH");
}

export async function deleteRegion(token: string, regionName: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/accounts/v1/${regionName}`, undefined, "DELETE");
}

export async function listReturnPolicies(token: string, accountId: string): Promise<ReturnPolicyDoc[]> {
  const out: ReturnPolicyDoc[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await fetchGoogle<{ onlineReturnPolicies?: ReturnPolicyDoc[]; nextPageToken?: string }>(
      token,
      `${acct(accountId)}/onlineReturnPolicies?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
    );
    out.push(...(r.onlineReturnPolicies ?? []));
    pageToken = r.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

export function createReturnPolicy(token: string, accountId: string, policy: ReturnPolicyDoc): Promise<ReturnPolicyDoc> {
  return fetchGoogle<ReturnPolicyDoc>(token, `${acct(accountId)}/onlineReturnPolicies`, policy);
}

export async function deleteReturnPolicy(token: string, policyName: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/accounts/v1/${policyName}`, undefined, "DELETE");
}

export type AccountIssue = { title: string; detail: string | null; severity: "CRITICAL" | "ERROR" | "SUGGESTION" | "OTHER"; documentation: string | null; destinations: string[] };

/** Account-level problems (suspensions, policy warnings) shown as a banner on every Shopping tab. */
export async function listAccountIssues(token: string, accountId: string): Promise<AccountIssue[]> {
  const r = await call<{
    accountIssues?: { title?: string; detail?: string; severity?: string; documentationUri?: string; impactedDestinations?: { reportingContext?: string }[] }[];
  }>(token, `${acct(accountId)}/issues?pageSize=100`);
  return (r.accountIssues ?? []).map((i) => ({
    title: i.title ?? "Account issue",
    detail: i.detail ?? null,
    severity: i.severity === "CRITICAL" || i.severity === "ERROR" || i.severity === "SUGGESTION" ? i.severity : "OTHER",
    documentation: i.documentationUri && /^https:\/\//.test(i.documentationUri) ? i.documentationUri : null,
    destinations: (i.impactedDestinations ?? []).map((d) => d.reportingContext ?? "").filter(Boolean),
  }));
}

// ---- Merchant Center account settings: business info, homepage, programs, users

export type PostalAddressDoc = { regionCode?: string; postalCode?: string; administrativeArea?: string; locality?: string; addressLines?: string[]; organization?: string };
export type BusinessInfoDoc = {
  address?: PostalAddressDoc;
  phone?: { e164Number?: string };
  phoneVerificationState?: string;
  customerService?: { email?: string; uri?: string; phone?: { e164Number?: string } };
};
export type HomepageDoc = { name?: string; uri?: string; claimed?: boolean };
export type ProgramDoc = {
  name?: string;
  state?: "NOT_ELIGIBLE" | "ELIGIBLE" | "ENABLED" | "STATE_UNSPECIFIED";
  documentationUri?: string;
  activeRegionCodes?: string[];
  unmetRequirements?: { title?: string; documentationUri?: string; affectedRegionCodes?: string[] }[];
};
export type AccessRight = "STANDARD" | "READ_ONLY" | "ADMIN" | "PERFORMANCE_REPORTING" | "API_DEVELOPER";
export type UserDoc = { name?: string; state?: "PENDING" | "VERIFIED" | "STATE_UNSPECIFIED"; accessRights?: AccessRight[] };

/** Reads every page of a Merchant API list under `key`. */
async function allPages<T>(token: string, url: string, key: string, pageSize: number): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 10; i++) {
    const r = await fetchGoogle<Record<string, unknown>>(token, `${url}?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
    out.push(...((r[key] as T[] | undefined) ?? []));
    pageToken = r.nextPageToken as string | undefined;
    if (!pageToken) break;
  }
  return out;
}

/** A missing business info or homepage is a 404; treat it as empty. */
async function orEmpty<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 404) return {} as T;
    throw err;
  }
}

export type AccountDoc = { accountName?: string; timeZone?: { id?: string }; languageCode?: string };
export const getAccount = (token: string, accountId: string) => fetchGoogle<AccountDoc>(token, acct(accountId));
export const renameAccount = (token: string, accountId: string, accountName: string) =>
  fetchGoogle<AccountDoc>(token, `${acct(accountId)}?updateMask=account_name`, { accountName }, "PATCH");

export const getBusinessInfo = (token: string, accountId: string) => orEmpty(fetchGoogle<BusinessInfoDoc>(token, `${acct(accountId)}/businessInfo`));
export const updateBusinessInfo = (token: string, accountId: string, info: BusinessInfoDoc, updateMask: string) =>
  fetchGoogle<BusinessInfoDoc>(token, `${acct(accountId)}/businessInfo?updateMask=${encodeURIComponent(updateMask)}`, info, "PATCH");

export const getHomepage = (token: string, accountId: string) => orEmpty(fetchGoogle<HomepageDoc>(token, `${acct(accountId)}/homepage`));
export const updateHomepage = (token: string, accountId: string, uri: string) =>
  fetchGoogle<HomepageDoc>(token, `${acct(accountId)}/homepage?updateMask=uri`, { uri }, "PATCH");
export const claimHomepage = (token: string, accountId: string, overwrite: boolean) => fetchGoogle<HomepageDoc>(token, `${acct(accountId)}/homepage:claim`, { overwrite });
export const unclaimHomepage = (token: string, accountId: string) => fetchGoogle<HomepageDoc>(token, `${acct(accountId)}/homepage:unclaim`, {});

export const listPrograms = (token: string, accountId: string) => allPages<ProgramDoc>(token, `${acct(accountId)}/programs`, "programs", 1000);
export const setProgram = (token: string, programName: string, enable: boolean) =>
  fetchGoogle<ProgramDoc>(token, `${MERCHANT_API}/accounts/v1/${programName}:${enable ? "enable" : "disable"}`, {});

export const listUsers = (token: string, accountId: string) => allPages<UserDoc>(token, `${acct(accountId)}/users`, "users", 100);
export const createUser = (token: string, accountId: string, email: string, accessRights: AccessRight[]) =>
  fetchGoogle<UserDoc>(token, `${acct(accountId)}/users?userId=${encodeURIComponent(email)}`, { accessRights });
export const updateUser = (token: string, userName: string, accessRights: AccessRight[]) =>
  fetchGoogle<UserDoc>(token, `${MERCHANT_API}/accounts/v1/${userName}?updateMask=access_rights`, { accessRights }, "PATCH");
export async function deleteUser(token: string, userName: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/accounts/v1/${userName}`, undefined, "DELETE");
}

// ---- products and data sources

export type ProductDoc = ApiProduct & { productStatus?: ApiProduct["productStatus"] & { lastUpdateDate?: string; creationDate?: string } };

export const getProduct = (token: string, productName: string) => fetchGoogle<ProductDoc>(token, `${MERCHANT_API}/products/v1/${productName}`);

export type ProductInputDoc = { offerId: string; contentLanguage: string; feedLabel: string; productAttributes: Record<string, unknown> };

export const insertProductInput = (token: string, accountId: string, dataSource: string, input: ProductInputDoc) =>
  fetchGoogle<ProductInputDoc>(token, `${MERCHANT_API}/products/v1/accounts/${accountId}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`, input);

/** `updateMask` lists top-level attributes; named ones missing from the body are removed. */
export const patchProductInput = (token: string, inputName: string, dataSource: string, input: ProductInputDoc, updateMask: string[]) =>
  fetchGoogle<ProductInputDoc>(
    token,
    `${MERCHANT_API}/products/v1/${inputName}?dataSource=${encodeURIComponent(dataSource)}&updateMask=${encodeURIComponent(updateMask.map((f) => `productAttributes.${f}`).join(","))}`,
    input,
    "PATCH",
  );

export async function deleteProductInput(token: string, inputName: string, dataSource: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/products/v1/${inputName}?dataSource=${encodeURIComponent(dataSource)}`, undefined, "DELETE");
}

export type DataSourceRef = { self?: boolean; supplementalDataSourceName?: string; primaryDataSourceName?: string };
export type DataSourceDoc = {
  name?: string;
  dataSourceId?: string;
  displayName?: string;
  input?: "API" | "FILE" | "UI" | "AUTOFEED" | "INPUT_UNSPECIFIED";
  primaryProductDataSource?: { feedLabel?: string; contentLanguage?: string; countries?: string[]; defaultRule?: { takeFromDataSources?: DataSourceRef[] }; destinations?: { destination?: string; state?: string }[] };
  supplementalProductDataSource?: { feedLabel?: string; contentLanguage?: string; referencingPrimaryDataSources?: DataSourceRef[] };
  promotionDataSource?: { targetCountry?: string; contentLanguage?: string };
  localInventoryDataSource?: Record<string, unknown>;
  regionalInventoryDataSource?: Record<string, unknown>;
  productReviewDataSource?: Record<string, unknown>;
  merchantReviewDataSource?: Record<string, unknown>;
  fileInput?: {
    fileInputType?: "UPLOAD" | "FETCH" | "GOOGLE_SHEETS" | "FILE_INPUT_TYPE_UNSPECIFIED";
    fileName?: string;
    fetchSettings?: { enabled?: boolean; fetchUri?: string; frequency?: string; dayOfWeek?: string; dayOfMonth?: number; timeOfDay?: { hours?: number }; timeZone?: string; username?: string; password?: string };
  };
};
export type FileUploadDoc = {
  processingState?: "FAILED" | "IN_PROGRESS" | "SUCCEEDED" | "PROCESSING_STATE_UNSPECIFIED";
  itemsTotal?: string;
  itemsCreated?: string;
  itemsUpdated?: string;
  uploadTime?: string;
  issues?: { title?: string; description?: string; code?: string; count?: string; severity?: string; documentationUri?: string }[];
};

const DS = (accountId: string) => `${MERCHANT_API}/datasources/v1/accounts/${accountId}/dataSources`;
export const listDataSources = (token: string, accountId: string) => allPages<DataSourceDoc>(token, DS(accountId), "dataSources", 1000);
export const getDataSource = (token: string, dsName: string) => fetchGoogle<DataSourceDoc>(token, `${MERCHANT_API}/datasources/v1/${dsName}`);
export const createDataSource = (token: string, accountId: string, ds: DataSourceDoc) => fetchGoogle<DataSourceDoc>(token, DS(accountId), ds);
export const patchDataSource = (token: string, dsName: string, ds: DataSourceDoc, updateMask: string) =>
  fetchGoogle<DataSourceDoc>(token, `${MERCHANT_API}/datasources/v1/${dsName}?updateMask=${encodeURIComponent(updateMask)}`, ds, "PATCH");
export async function deleteDataSource(token: string, dsName: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/datasources/v1/${dsName}`, undefined, "DELETE");
}
export async function fetchDataSourceNow(token: string, dsName: string): Promise<void> {
  await fetchGoogle(token, `${MERCHANT_API}/datasources/v1/${dsName}:fetch`, {});
}
/** The latest file upload of a file feed; `null` when there's none yet. */
export async function latestFileUpload(token: string, dsName: string): Promise<FileUploadDoc | null> {
  try {
    return await fetchGoogle<FileUploadDoc>(token, `${MERCHANT_API}/datasources/v1/${dsName}/fileUploads/latest`);
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 404) return null;
    throw err;
  }
}
