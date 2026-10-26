import "server-only";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, toDateKey, utcDay } from "@/lib/dates";
import { averagePosition, visibilityScore } from "@/lib/visibility";
import type { OverviewPoint, ProjectReport, RankingRow } from "@/lib/types";

/** Every read is scoped to the owner. Returns null rather than leaking existence. */
export function getProject(projectId: string, userId: string) {
  return db.project.findFirst({ where: { id: projectId, userId } });
}

export function listProjects(userId: string) {
  return db.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { keywords: true } } },
  });
}

export async function getRankingRows(projectId: string, days: number): Promise<RankingRow[]> {
  const from = daysAgo(days - 1);
  const keywords = await db.keyword.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: {
      snapshots: { where: { checkedAt: { gte: from } }, orderBy: { checkedAt: "asc" } },
    },
  });

  return keywords.map((k) => {
    const history = k.snapshots.map((s) => ({ date: toDateKey(s.checkedAt), position: s.position }));
    const last = k.snapshots.at(-1);
    const first = k.snapshots[0];
    const position = last?.position ?? null;
    const previous = first && first !== last ? first.position : null;
    const ranked = k.snapshots.map((s) => s.position).filter((p): p is number => p != null);
    return {
      keywordId: k.id,
      phrase: k.phrase,
      tags: k.tags ? k.tags.split(",").filter(Boolean) : [],
      searchVolume: k.searchVolume,
      position,
      previous,
      change: rankChange(previous, position),
      best: ranked.length ? Math.min(...ranked) : null,
      url: last?.url ?? null,
      history,
    };
  });
}

/** Positive = improved. Entering the results counts from 101, leaving counts to 101. */
export function rankChange(previous: number | null, current: number | null): number | null {
  if (previous == null && current == null) return null;
  return (previous ?? 101) - (current ?? 101);
}

export async function getProjectReport(projectId: string, days: number): Promise<ProjectReport | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const to = utcDay();
  const from = daysAgo(days - 1);
  const [rows, gsc, ga4] = await Promise.all([
    getRankingRows(projectId, days),
    db.searchConsoleDaily.findMany({ where: { projectId, date: { gte: from } } }),
    db.analyticsDaily.findMany({ where: { projectId, date: { gte: from } } }),
  ]);

  const gscBy = new Map(gsc.map((g) => [toDateKey(g.date), g]));
  const ga4By = new Map(ga4.map((g) => [toDateKey(g.date), g]));
  const volume = new Map(rows.map((r) => [r.keywordId, r.searchVolume]));
  const rankBy = new Map<string, { position: number | null; volume: number | null }[]>();
  for (const r of rows) {
    for (const h of r.history) {
      const list = rankBy.get(h.date) ?? [];
      list.push({ position: h.position, volume: volume.get(r.keywordId) ?? null });
      rankBy.set(h.date, list);
    }
  }

  const series: OverviewPoint[] = dateKeys(from, to).map((date) => {
    const g = gscBy.get(date);
    const a = ga4By.get(date);
    const ranks = rankBy.get(date);
    return {
      date,
      clicks: g?.clicks ?? null,
      impressions: g?.impressions ?? null,
      sessions: a?.sessions ?? null,
      conversions: a?.conversions ?? null,
      avgPosition: ranks ? averagePosition(ranks.map((x) => x.position)) : null,
      visibility: ranks ? visibilityScore(ranks) : null,
    };
  });

  const current = rows.map((r) => ({ position: r.position, volume: r.searchVolume }));
  const visibility = visibilityScore(current);
  const firstVis = series.find((p) => p.visibility != null)?.visibility ?? null;
  const moved = rows.filter((r) => r.change != null && r.change !== 0);

  return {
    project: { id: project.id, name: project.name, domain: project.domain, isDemo: project.isDemo },
    range: { from: toDateKey(from), to: toDateKey(to), days },
    totals: {
      trackedKeywords: rows.length,
      avgPosition: averagePosition(rows.map((r) => r.position)),
      visibility,
      visibilityChange: visibility != null && firstVis != null ? visibility - firstVis : null,
      top3: rows.filter((r) => r.position != null && r.position <= 3).length,
      top10: rows.filter((r) => r.position != null && r.position <= 10).length,
      clicks: gsc.reduce((s, g) => s + g.clicks, 0),
      impressions: gsc.reduce((s, g) => s + g.impressions, 0),
      sessions: ga4.reduce((s, g) => s + g.sessions, 0),
      conversions: ga4.reduce((s, g) => s + g.conversions, 0),
    },
    series,
    movers: {
      up: [...moved].sort((a, b) => b.change! - a.change!).filter((r) => r.change! > 0).slice(0, 5),
      down: [...moved].sort((a, b) => a.change! - b.change!).filter((r) => r.change! < 0).slice(0, 5),
    },
  };
}

export async function getDomainData(projectId: string, days: number) {
  const from = daysAgo(days - 1);
  const [snapshots, pages] = await Promise.all([
    db.domainSnapshot.findMany({ where: { projectId, capturedAt: { gte: from } }, orderBy: { capturedAt: "asc" } }),
    db.topPage.findMany({ where: { projectId }, orderBy: { traffic: "desc" }, take: 50 }),
  ]);
  return { snapshots, pages };
}

export function getBacklinks(projectId: string) {
  return db.backlink.findMany({ where: { projectId }, orderBy: { domainFromRank: "desc" } });
}

export function getGscQueries(projectId: string) {
  return db.searchConsoleQuery.findMany({ where: { projectId }, orderBy: { clicks: "desc" }, take: 500 });
}
