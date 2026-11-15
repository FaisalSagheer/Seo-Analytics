import "server-only";
import { db } from "@/lib/db";
import { daysAgo, toDateKey, utcDay } from "@/lib/dates";
import { ProviderNotConfiguredError, getGoogleAccessToken } from "@/lib/providers";
import { ga4Daily, ga4ReferralDaily, ga4ReferralPages, gscDaily, gscKeywordHistory, gscQueries } from "@/lib/providers/google";
import { gscCountry } from "@/lib/markets";
import { demoReferralPages, demoReferrals, demoTraffic } from "@/lib/demo/series";
import { REFERRAL_WINDOW_DAYS } from "@/lib/referrals";
import { dayIndex, demoPosition } from "@/lib/demo/rankings";
import type { Project } from "@/generated/prisma/client";

export type SyncPart = "rankings" | "google";
export type SyncResult = Record<SyncPart, { ok: boolean; message: string; warning?: string } | undefined>;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export async function syncRankings(project: Project, keywordIds?: string[]) {
  const keywords = await db.keyword.findMany({
    where: { projectId: project.id, ...(keywordIds ? { id: { in: keywordIds } } : {}) },
  });
  if (project.isDemo) return syncDemoRankings(project, keywords);
  if (!project.gscSiteUrl) throw new ProviderNotConfiguredError("Pick a Search Console site in Project settings to track rankings.");
  return syncRankingsFromSearchConsole(project, keywords);
}

/** The demo project has no Google account behind it, so its positions are generated. */
async function syncDemoRankings(project: Project, keywords: { id: string; phrase: string }[]) {
  const today = utcDay();
  const day = dayIndex();
  await mapLimit(keywords, 5, async (k) => {
    const position = demoPosition(k.phrase, day);
    const url = position ? `https://${project.domain}/${k.phrase.replace(/\s+/g, "-")}` : null;
    await db.rankSnapshot.upsert({
      where: { keywordId_checkedAt: { keywordId: k.id, checkedAt: today } },
      create: { keywordId: k.id, checkedAt: today, position, url, source: "DEMO" },
      update: { position, url, source: "DEMO" },
    });
  });
  return { checked: keywords.length, failed: 0, source: "DEMO" as const };
}

/**
 * Rank history from Search Console: the average position of the site for each
 * tracked keyword, per day, back 90 days. Days with no impressions get no row.
 */
async function syncRankingsFromSearchConsole(project: Project, keywords: { id: string; phrase: string }[]) {
  const token = await getGoogleAccessToken(project);
  const siteUrl = project.gscSiteUrl!;
  const start = toDateKey(daysAgo(90));
  const end = toDateKey(utcDay());
  const filters = { device: project.device === "MOBILE" ? ("MOBILE" as const) : ("DESKTOP" as const), country: gscCountry(project.locationCode) };
  let failed = 0;
  let noData = 0;
  let lastError = "";
  await mapLimit(keywords, 5, async (k) => {
    try {
      const { days, url } = await gscKeywordHistory(token, siteUrl, k.phrase, start, end, filters);
      if (days.length === 0) {
        noData++;
        return;
      }
      await db.$transaction(
        days.map((d) => {
          const checkedAt = new Date(`${d.date}T00:00:00Z`);
          return db.rankSnapshot.upsert({
            where: { keywordId_checkedAt: { keywordId: k.id, checkedAt } },
            create: { keywordId: k.id, checkedAt, position: d.position, url, source: "GOOGLE" },
            update: { position: d.position, url, source: "GOOGLE" },
          });
        }),
      );
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[sync] Search Console rank history failed for "${k.phrase}":`, err);
    }
  });
  if (keywords.length > 0 && failed === keywords.length) throw new Error(lastError);
  const warnings: string[] = [];
  if (noData > 0) {
    warnings.push(
      `${noData} keyword${noData === 1 ? "" : "s"} had no Search Console impressions in the last 90 days (${filters.country ? "this country, " : ""}${filters.device.toLowerCase()}), so there's no position yet.`,
    );
  }
  return { checked: keywords.length - failed - noData, failed, source: "GOOGLE" as const, warnings };
}

async function syncDemoGoogle(project: Project) {
  const days = Array.from({ length: 7 }, (_, i) => daysAgo(i));
  await db.$transaction(
    days.flatMap((date) => {
      const { gsc, ga4 } = demoTraffic(project.domain, date);
      return [
        db.searchConsoleDaily.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: { projectId: project.id, date, ...gsc },
          update: gsc,
        }),
        db.analyticsDaily.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: { projectId: project.id, date, ...ga4 },
          update: ga4,
        }),
      ];
    }),
  );
  // Referral rows for the same days, replaced so a refresh never doubles them
  await db.$transaction([
    db.referralDaily.deleteMany({ where: { projectId: project.id, date: { gte: days[days.length - 1] } } }),
    db.referralDaily.createMany({ data: days.flatMap((date) => demoReferrals(project.domain, date).map((r) => ({ projectId: project.id, date, ...r }))) }),
    db.referralPage.deleteMany({ where: { projectId: project.id } }),
    db.referralPage.createMany({ data: demoReferralPages(project.domain).map((r) => ({ projectId: project.id, ...r })) }),
  ]);
  return { gscDays: days.length, gaDays: days.length };
}


/**
 * Pulls the sites and pages that sent visits. The daily history is the part that matters; the page
 * list is best-effort, so a problem with it is reported as a warning and doesn't undo the rest.
 */
async function syncReferrals(project: Project, token: string) {
  const propertyId = project.ga4PropertyId!;
  const end = toDateKey(utcDay());
  const from = daysAgo(REFERRAL_WINDOW_DAYS);
  const daily = await ga4ReferralDaily(token, propertyId, toDateKey(from), end);
  // The window is replaced as a whole: days Google no longer reports must not linger
  await db.$transaction([
    db.referralDaily.deleteMany({ where: { projectId: project.id, date: { gte: from } } }),
    db.referralDaily.createMany({
      data: daily.map((d) => ({ projectId: project.id, date: new Date(`${d.date}T00:00:00Z`), source: d.source, sessions: d.sessions, users: d.users, conversions: d.conversions })),
    }),
  ]);
  const result = { sites: new Set(daily.map((d) => d.source)).size, pages: 0, warning: undefined as string | undefined };
  try {
    const pages = await ga4ReferralPages(token, propertyId, toDateKey(daysAgo(28)), end);
    await db.$transaction([
      db.referralPage.deleteMany({ where: { projectId: project.id } }),
      db.referralPage.createMany({ data: pages.map((p) => ({ projectId: project.id, ...p })) }),
    ]);
    result.pages = pages.length;
  } catch (err) {
    result.warning = `Referring pages couldn't be loaded (${err instanceof Error ? err.message : String(err)}). The list of sites is up to date.`;
  }
  return result;
}

export async function syncGoogle(project: Project) {
  if (project.isDemo) return syncDemoGoogle(project);
  if (!project.gscSiteUrl && !project.ga4PropertyId) {
    return { skipped: "No Search Console site or GA4 property selected in project settings." };
  }
  const token = await getGoogleAccessToken(project);
  // GSC data lags ~2 days; pull a rolling window so late rows are corrected
  const end = toDateKey(utcDay());
  const start = toDateKey(daysAgo(90));
  let gscDays = 0;
  let gaDays = 0;
  let referral = { sites: 0, pages: 0 };
  const warnings: string[] = [];

  if (project.gscSiteUrl) {
    const [daily, queries] = await Promise.all([
      gscDaily(token, project.gscSiteUrl, start, end),
      gscQueries(token, project.gscSiteUrl, toDateKey(daysAgo(28)), end),
    ]);
    await db.$transaction([
      ...daily.map((d) => {
        const date = new Date(`${d.date}T00:00:00Z`);
        const data = { clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, position: d.position };
        return db.searchConsoleDaily.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: { projectId: project.id, date, ...data },
          update: data,
        });
      }),
      db.searchConsoleQuery.deleteMany({ where: { projectId: project.id } }),
      db.searchConsoleQuery.createMany({ data: queries.map((q) => ({ ...q, projectId: project.id })) }),
    ]);
    gscDays = daily.length;
  }

  if (project.ga4PropertyId) {
    const daily = await ga4Daily(token, project.ga4PropertyId, start, end);
    await db.$transaction(
      daily.map((d) => {
        const date = new Date(`${d.date}T00:00:00Z`);
        const data = { sessions: d.sessions, users: d.users, conversions: d.conversions, engagementRate: d.engagementRate };
        return db.analyticsDaily.upsert({
          where: { projectId_date: { projectId: project.id, date } },
          create: { projectId: project.id, date, ...data },
          update: data,
        });
      }),
    );
    gaDays = daily.length;
    try {
      const ref = await syncReferrals(project, token);
      referral = { sites: ref.sites, pages: ref.pages };
      if (ref.warning) warnings.push(ref.warning);
    } catch (err) {
      warnings.push(`Referral links couldn't be loaded: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { gscDays, gaDays, referral, warnings };
}

/** Runs each part independently so one failing provider doesn't block the rest. */
export async function syncProject(project: Project, parts: SyncPart[] = ["rankings", "google"]): Promise<SyncResult> {
  const result: SyncResult = { rankings: undefined, google: undefined };
  const runners: Record<SyncPart, () => Promise<unknown>> = {
    rankings: () => syncRankings(project),
    google: () => syncGoogle(project),
  };
  for (const part of parts) {
    try {
      const r = await runners[part]();
      const warnings = (r as { warnings?: string[] }).warnings;
      result[part] = { ok: true, message: JSON.stringify(r), warning: warnings?.length ? warnings.join(" ") : undefined };
    } catch (err) {
      result[part] = { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }
  await db.project.update({ where: { id: project.id }, data: { lastSyncedAt: new Date() } });
  return result;
}
