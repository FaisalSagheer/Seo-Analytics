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
