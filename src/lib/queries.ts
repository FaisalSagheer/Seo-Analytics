import "server-only";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, toDateKey, utcDay } from "@/lib/dates";
import { averagePosition, visibilityScore } from "@/lib/visibility";
import type { OverviewPoint, ProjectReport, RankingRow } from "@/lib/types";

/** Use listProjectsFor / canViewProject for anything a user can reach; this is the raw row. */
export function getProject(projectId: string) {
  return db.project.findUnique({ where: { id: projectId } });
}


/** A page counts as competing for a keyword when it gets at least this share of the keyword's impressions. */
export const COMPETING_SHARE = 0.2;

export async function getRankingRows(projectId: string, days: number): Promise<RankingRow[]> {
  const from = daysAgo(days - 1);
  const [keywords, pageTotals] = await Promise.all([
    db.keyword.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: {
        snapshots: { where: { checkedAt: { gte: from } }, orderBy: { checkedAt: "asc" } },
      },
    }),
    db.rankPage.groupBy({
      by: ["keywordId", "page"],
      where: { date: { gte: from }, keyword: { projectId } },
      _sum: { impressions: true },
    }),
  ]);
  // How many pages split each keyword's impressions in the range
  const shares = new Map<string, number[]>();
  for (const t of pageTotals) {
    const list = shares.get(t.keywordId) ?? [];
    list.push(t._sum.impressions ?? 0);
    shares.set(t.keywordId, list);
  }
  const competing = (keywordId: string) => {
    const list = shares.get(keywordId) ?? [];
    const total = list.reduce((a, b) => a + b, 0);
    return total > 0 ? list.filter((n) => n / total >= COMPETING_SHARE).length : 0;
  };

  return keywords.map((k) => {
    const history = k.snapshots.map((s) => ({ date: toDateKey(s.checkedAt), position: s.position }));
    const last = k.snapshots.at(-1);
    const first = k.snapshots[0];
    const position = last?.position ?? null;
    // A keyword checked only once has no earlier reading to compare against
    const hasPrevious = Boolean(first && first !== last);
    const previous = hasPrevious ? first!.position : null;
    const ranked = k.snapshots.map((s) => s.position).filter((p): p is number => p != null);
    return {
      keywordId: k.id,
      phrase: k.phrase,
      tags: k.tags ? k.tags.split(",").filter(Boolean) : [],
      searchVolume: k.searchVolume,
      position,
      previous,
      change: hasPrevious ? rankChange(previous, position) : null,
      best: ranked.length ? Math.min(...ranked) : null,
      url: last?.url ?? null,
      // The most recent earlier page that differs from today's, if the ranking page switched in this range
      previousUrl: last?.url ? ([...k.snapshots].reverse().find((s) => s.url && s.url !== last.url)?.url ?? null) : null,
      competingPages: competing(k.id),
      history,
    };
  });
}

/** Positive = improved. Entering the results counts from 101, leaving counts to 101. */
export function rankChange(previous: number | null, current: number | null): number | null {
  if (previous == null && current == null) return null;
  return (previous ?? 101) - (current ?? 101);
}

export async function getProjectReport(projectId: string, days: number, range?: { from: Date; to: Date }): Promise<ProjectReport | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const to = range?.to ?? utcDay();
  const from = range?.from ?? daysAgo(days - 1);
  const [rows, gsc, ga4] = await Promise.all([
    getRankingRows(projectId, days),
    db.searchConsoleDaily.findMany({ where: { projectId, date: { gte: from, lte: to } } }),
    db.analyticsDaily.findMany({ where: { projectId, date: { gte: from, lte: to } } }),
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

export function getGscQueries(projectId: string) {
  return db.searchConsoleQuery.findMany({ where: { projectId }, orderBy: { clicks: "desc" }, take: 500 });
}
