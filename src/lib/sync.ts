import "server-only";
import { db } from "@/lib/db";
import { daysAgo, toDateKey, utcDay } from "@/lib/dates";
import { ProviderNotConfiguredError, getBingApiKey, getGoogleAccessToken, getRankChecker, getSeoProvider } from "@/lib/providers";
import { fetchBingBacklinks, listBingSites } from "@/lib/providers/bing";
import { bareDomain } from "@/lib/domain";
import type { BacklinkRow, DomainMetrics, TopPageRow } from "@/lib/types";
import { ga4Daily, gscDaily, gscQueries } from "@/lib/providers/google";
import { demoTraffic } from "@/lib/demo/series";
import { demoBingBacklinks } from "@/lib/demo/provider";
import type { Project } from "@/generated/prisma/client";

export type SyncPart = "rankings" | "domain" | "google";
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
  const { source, checkRank } = await getRankChecker(project);
  const keywords = await db.keyword.findMany({
    where: { projectId: project.id, ...(keywordIds ? { id: { in: keywordIds } } : {}) },
  });
  const today = utcDay();
  let failed = 0;
  let lastError = "";
  await mapLimit(keywords, 5, async (k) => {
    try {
      const r = await checkRank({
        keyword: k.phrase,
        domain: project.domain,
        locationCode: project.locationCode,
        languageCode: project.languageCode,
        device: project.device === "MOBILE" ? "mobile" : "desktop",
      });
      await db.rankSnapshot.upsert({
        where: { keywordId_checkedAt: { keywordId: k.id, checkedAt: today } },
        create: { keywordId: k.id, checkedAt: today, position: r.position, url: r.url, source },
        update: { position: r.position, url: r.url, source },
      });
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[sync] rank check failed for "${k.phrase}":`, err);
    }
  });
  // Every check failing (bad key, no credits) is a provider problem, not a partial result
  if (keywords.length > 0 && failed === keywords.length) throw new Error(lastError);
  return { checked: keywords.length - failed, failed, source };
}

export async function syncDomain(project: Project) {
  const provider = await getSeoProvider(project).catch((err) => {
    if (err instanceof ProviderNotConfiguredError) return null;
    throw err;
  });
  const market = { locationCode: project.locationCode, languageCode: project.languageCode };
  const warnings: string[] = [];

  // Organic footprint: DataForSEO (or demo) only
  let overview: DomainMetrics | null = null;
  let pages: TopPageRow[] | null = null;
  if (provider) {
    [overview, pages] = await Promise.all([
      provider.domainOverview({ ...market, domain: project.domain }),
      provider.topPages({ ...market, domain: project.domain, limit: 50 }),
    ]);
  }

  // Backlinks: every source the project has switched on, fetched independently
  // and stored side by side so the Backlinks page can switch between them.
  // One source failing (e.g. no DataForSEO Backlinks subscription) is a warning.
  const fetched: BacklinkSourceResult[] = [];
  let attempted = 0;
  if (project.backlinksDataForSeo && provider) {
    attempted++;
    try {
      const [summary, links] = await Promise.all([
        provider.backlinkSummary({ domain: project.domain }),
        provider.backlinks({ domain: project.domain, limit: 200 }),
      ]);
      fetched.push({
        source: provider.name === "demo" ? "DEMO" : "DATAFORSEO",
        links,
        total: summary.backlinks,
        referringDomains: summary.referringDomains,
        domainRank: summary.domainRank,
      });
    } catch (err) {
      warnings.push(`DataForSEO backlinks failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (project.backlinksBing) {
    if (project.isDemo) {
      attempted++;
      fetched.push({ source: "BING", ...demoBingBacklinks(project.domain), domainRank: null });
    } else if (await getBingApiKey(project.userId)) {
      attempted++;
      try {
        const bing = (await getBingForProject(project))!;
        const r = await fetchBingBacklinks(bing.apiKey, bing.siteUrl);
        fetched.push({ source: "BING", links: r.links, total: r.total, referringDomains: r.referringDomains, domainRank: null });
      } catch (err) {
        warnings.push(`Bing backlinks failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (!overview && fetched.length === 0) {
    if (attempted > 0) throw new Error(warnings.join(" "));
    throw new ProviderNotConfiguredError(
      "Connect DataForSEO for domain data, or Bing Webmaster Tools (free) for your own site's backlinks, in Settings → Providers.",
    );
  }

  const today = utcDay();
  // DomainSnapshot keeps one backlink figure (the richest source) for the domain API;
  // per-source history lives in BacklinkSnapshot.
  const primary = fetched.find((f) => f.source !== "BING") ?? fetched[0];
  const snapshot = {
    ...(overview && {
      organicKeywords: overview.organicKeywords,
      organicTraffic: overview.organicTraffic,
      trafficCost: overview.trafficCost,
      pos1: overview.pos1,
      pos2to3: overview.pos2to3,
      pos4to10: overview.pos4to10,
    }),
    ...(primary && { backlinks: primary.total, referringDomains: primary.referringDomains, domainRank: primary.domainRank }),
  };
  await db.$transaction([
    db.domainSnapshot.upsert({
      where: { projectId_capturedAt: { projectId: project.id, capturedAt: today } },
      create: { projectId: project.id, capturedAt: today, ...snapshot },
      update: snapshot,
    }),
    ...(pages
      ? [
          db.topPage.deleteMany({ where: { projectId: project.id } }),
          db.topPage.createMany({ data: pages.map((p) => ({ ...p, projectId: project.id })) }),
        ]
      : []),
    ...fetched.flatMap((f) => {
      const totals = { backlinks: f.total, referringDomains: f.referringDomains, domainRank: f.domainRank };
      return [
        db.backlink.deleteMany({ where: { projectId: project.id, source: f.source } }),
        db.backlink.createMany({ data: f.links.map((l) => ({ ...l, projectId: project.id, source: f.source })) }),
        db.backlinkSnapshot.upsert({
          where: { projectId_capturedAt_source: { projectId: project.id, capturedAt: today, source: f.source } },
          create: { projectId: project.id, capturedAt: today, source: f.source, ...totals },
          update: totals,
        }),
      ];
    }),
  ]);
  return { organic: Boolean(overview), backlinkSources: fetched.map((f) => f.source), warnings };
}

type BacklinkSourceResult = {
  source: "DATAFORSEO" | "DEMO" | "BING";
  links: BacklinkRow[];
  total: number;
  referringDomains: number;
  domainRank: number | null;
};

/** The owner's Bing key (or the server's) plus the project's Bing site, auto-matched by domain if unset. */
async function getBingForProject(project: Project) {
  const apiKey = await getBingApiKey(project.userId);
  if (!apiKey) return null;
  let siteUrl = project.bingSiteUrl;
  if (!siteUrl) {
    const sites = await listBingSites(apiKey);
    siteUrl = sites.find((s) => bareDomain(s) === bareDomain(project.domain)) ?? null;
    if (!siteUrl) {
      throw new Error(`${project.domain} isn't a verified site in your Bing Webmaster Tools account. Add and verify it there, then pick it in Project settings.`);
    }
    await db.project.update({ where: { id: project.id }, data: { bingSiteUrl: siteUrl } });
  }
  return { apiKey, siteUrl };
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
  return { gscDays: days.length, gaDays: days.length };
}

export async function syncGoogle(project: Project) {
  if (project.isDemo) return syncDemoGoogle(project);
  if (!project.gscSiteUrl && !project.ga4PropertyId) {
    return { skipped: "No Search Console site or GA4 property selected in project settings." };
  }
  const token = await getGoogleAccessToken(project.userId);
  // GSC data lags ~2 days; pull a rolling window so late rows are corrected
  const end = toDateKey(utcDay());
  const start = toDateKey(daysAgo(90));
  let gscDays = 0;
  let gaDays = 0;

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
  }
  return { gscDays, gaDays };
}

/** Runs each part independently so one failing provider doesn't block the rest. */
export async function syncProject(project: Project, parts: SyncPart[] = ["rankings", "domain", "google"]): Promise<SyncResult> {
  const result: SyncResult = { rankings: undefined, domain: undefined, google: undefined };
  const runners: Record<SyncPart, () => Promise<unknown>> = {
    rankings: () => syncRankings(project),
    domain: () => syncDomain(project),
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
