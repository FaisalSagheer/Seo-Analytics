import type { PrismaClient } from "@/generated/prisma/client";
import { demoPosition, demoVolume } from "@/lib/demo/rankings";
import { DEMO_KEYWORDS, DEMO_QUERIES, demoLinkImports, demoReferralPages, demoReferrals, demoTraffic } from "@/lib/demo/series";
import { rng } from "@/lib/demo/random";

export const DEMO_DOMAIN = "demo.seoengine.example";
const HISTORY_DAYS = 180;

function day(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
}

/** Creates a fully populated demo project (rankings, Search Console, GA4) for a user. */
export async function seedDemoProject(db: PrismaClient, userId: string) {
  const project = await db.project.create({
    data: { userId, name: "Demo project", domain: DEMO_DOMAIN, isDemo: true, lastSyncedAt: new Date(), members: { create: { userId } } },
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

  await db.referralDaily.createMany({
    data: days.flatMap((date) => demoReferrals(DEMO_DOMAIN, date).map((r) => ({ projectId: project.id, date, ...r }))),
  });
  await db.referralPage.createMany({ data: demoReferralPages(DEMO_DOMAIN).map((r) => ({ projectId: project.id, ...r })) });

  for (const imp of demoLinkImports(DEMO_DOMAIN)) {
    await db.linkImport.create({
      data: {
        projectId: project.id,
        createdById: userId,
        asOf: day(imp.daysAgo),
        rows: {
          create: [
            ...imp.sites.map((r) => ({ kind: "SITE" as const, ...r })),
            ...imp.pages.map((r) => ({ kind: "PAGE" as const, ...r })),
            ...imp.texts.map((r) => ({ kind: "TEXT" as const, label: r.label, links: r.links })),
          ],
        },
      },
    });
  }

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
