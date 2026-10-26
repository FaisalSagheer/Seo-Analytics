import type { PrismaClient } from "@/generated/prisma/client";
import { demoBingBacklinks, demoPosition, demoProvider, demoVolume } from "@/lib/demo/provider";
import { DEMO_KEYWORDS, DEMO_QUERIES, demoTraffic } from "@/lib/demo/series";
import { rng } from "@/lib/demo/random";

export const DEMO_DOMAIN = "demo.bisibility.dev";
const HISTORY_DAYS = 180;

function day(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
}

/** Creates a fully populated demo project (rankings, GSC, GA4, domain, backlinks) for a user. */
export async function seedDemoProject(db: PrismaClient, userId: string) {
  const project = await db.project.create({
    data: { userId, name: "Demo project", domain: DEMO_DOMAIN, isDemo: true, lastSyncedAt: new Date() },
  });

  await db.keyword.createMany({
    data: DEMO_KEYWORDS.map((k) => ({ projectId: project.id, phrase: k.phrase, tags: k.tags, searchVolume: demoVolume(k.phrase) })),
  });
  const keywords = await db.keyword.findMany({ where: { projectId: project.id } });

  const snapshots = keywords.flatMap((k) =>
    Array.from({ length: HISTORY_DAYS }, (_, i) => {
      const date = day(i);
      const position = demoPosition(k.phrase, Math.floor(date.getTime() / 86_400_000));
      return {
        keywordId: k.id,
        checkedAt: date,
        position,
        url: position ? `https://${DEMO_DOMAIN}/${k.phrase.replace(/\s+/g, "-")}` : null,
        source: "DEMO" as const,
      };
    }),
  );
  await db.rankSnapshot.createMany({ data: snapshots });

  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => day(i));
  await db.searchConsoleDaily.createMany({
    data: days.map((date) => ({ projectId: project.id, date, ...demoTraffic(DEMO_DOMAIN, date).gsc })),
  });
  await db.analyticsDaily.createMany({
    data: days.map((date) => ({ projectId: project.id, date, ...demoTraffic(DEMO_DOMAIN, date).ga4 })),
  });

  // Weekly domain snapshots with gentle growth
  const summary = await demoProvider.backlinkSummary({ domain: DEMO_DOMAIN });
  await db.domainSnapshot.createMany({
    data: days
      .filter((_, i) => i % 7 === 0)
      .map((date, idx, arr) => {
        const t = 1 - idx / arr.length; // 1 = today, 0 = oldest
        const r = rng(`snap:${date.toISOString()}`);
        const keywordsCount = Math.round(2600 + 900 * t + r.int(-40, 40));
        return {
          projectId: project.id,
          capturedAt: date,
          organicKeywords: keywordsCount,
          organicTraffic: Math.round(keywordsCount * (4.6 + t)),
          trafficCost: Math.round(keywordsCount * 7.2),
          pos1: Math.round(keywordsCount * 0.04),
          pos2to3: Math.round(keywordsCount * 0.07),
          pos4to10: Math.round(keywordsCount * 0.19),
          backlinks: Math.round(summary.backlinks * (0.8 + 0.2 * t)),
          referringDomains: Math.round(summary.referringDomains * (0.82 + 0.18 * t)),
          domainRank: Math.round(summary.domainRank - 4 + 4 * t),
        };
      }),
  });

  const market = { locationCode: 2840, languageCode: "en", domain: DEMO_DOMAIN };
  const [pages, links] = await Promise.all([
    demoProvider.topPages({ ...market, limit: 15 }),
    demoProvider.backlinks({ domain: DEMO_DOMAIN, limit: 120 }),
  ]);
  await db.topPage.createMany({ data: pages.map((p) => ({ ...p, projectId: project.id })) });
  await db.backlink.createMany({ data: links.map((l) => ({ ...l, projectId: project.id, source: "DEMO" as const })) });

  // A Bing-style sample too, so the Backlinks page's source switch has two views
  const bing = demoBingBacklinks(DEMO_DOMAIN);
  await db.backlink.createMany({ data: bing.links.map((l) => ({ ...l, projectId: project.id, source: "BING" as const })) });
  const weeks = days.filter((_, i) => i % 7 === 0);
  await db.backlinkSnapshot.createMany({
    data: weeks.flatMap((date, idx) => {
      const t = 1 - idx / weeks.length; // 1 = today
      return [
        {
          projectId: project.id,
          capturedAt: date,
          source: "DEMO" as const,
          backlinks: Math.round(summary.backlinks * (0.8 + 0.2 * t)),
          referringDomains: Math.round(summary.referringDomains * (0.82 + 0.18 * t)),
          domainRank: Math.round(summary.domainRank - 4 + 4 * t),
        },
        {
          projectId: project.id,
          capturedAt: date,
          source: "BING" as const,
          backlinks: Math.round(bing.total * (0.75 + 0.25 * t)),
          // Bing counts domains in its fetched sample, so this stays small
          referringDomains: Math.max(1, Math.round(bing.referringDomains * (0.6 + 0.4 * t))),
          domainRank: null,
        },
      ];
    }),
  });

  await db.searchConsoleQuery.createMany({
    data: DEMO_QUERIES.map((query, i) => {
      const r = rng(`q:${query}`);
      const impressions = Math.round(42_000 / (i + 1) + r.int(200, 2000));
      const position = demoPosition(query, Math.floor(Date.now() / 86_400_000)) ?? r.float(30, 60);
      const ctr = Math.max(0.004, 0.3 / Math.max(1, position));
      return { projectId: project.id, query, impressions, clicks: Math.round(impressions * ctr), ctr, position };
    }),
  });

  return project;
}
