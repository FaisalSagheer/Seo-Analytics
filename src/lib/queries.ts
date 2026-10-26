import "server-only";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, toDateKey, utcDay } from "@/lib/dates";
import { averagePosition, visibilityScore } from "@/lib/visibility";
import type { BacklinkReport, OverviewPoint, ProjectReport, RankingRow } from "@/lib/types";
import { BACKLINK_VIEWS, getViewSources, type BacklinkViewKey } from "@/lib/backlinks";

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
  return db.backlink.findMany({ where: { projectId }, orderBy: [{ domainFromRank: "desc" }, { domainFrom: "asc" }] });
}

/**
 * One shape for the backlinks page, its CSV export and the printable report,
 * for one source view. Falls back to a view that has data when the requested one doesn't.
 */
export async function getBacklinkReport(
  projectId: string,
  days: number,
  requested: BacklinkViewKey | null = null,
): Promise<BacklinkReport | null> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const present = await db.backlinkSnapshot.groupBy({ by: ["source"], where: { projectId } });
  const presentSources = new Set(present.map((p) => p.source));
  const availableViews = BACKLINK_VIEWS.filter((v) => getViewSources(v).some((s) => presentSources.has(s)));
  const view = requested && availableViews.includes(requested) ? requested : (availableViews[0] ?? "dataforseo");
  const sources = getViewSources(view);

  const [snapshots, rows] = await Promise.all([
    db.backlinkSnapshot.findMany({
      where: { projectId, source: { in: sources }, capturedAt: { gte: daysAgo(days - 1) } },
      orderBy: { capturedAt: "asc" },
    }),
    db.backlink.findMany({
      where: { projectId, source: { in: sources } },
      orderBy: [{ domainFromRank: "desc" }, { domainFrom: "asc" }],
    }),
  ]);

  const latest = snapshots.at(-1);
  const first = snapshots[0];
  const typed = rows.filter((l) => l.dofollow != null);

  const anchorCounts = new Map<string, number>();
  const domainStats = new Map<string, { links: number; rank: number | null }>();
  for (const l of rows) {
    const a = l.anchor.trim() || "(no anchor)";
    anchorCounts.set(a, (anchorCounts.get(a) ?? 0) + 1);
    const d = domainStats.get(l.domainFrom) ?? { links: 0, rank: null };
    d.links++;
    if (l.domainFromRank != null) d.rank = Math.max(d.rank ?? 0, l.domainFromRank);
    domainStats.set(l.domainFrom, d);
  }

  return {
    project: { id: project.id, name: project.name, domain: project.domain, isDemo: project.isDemo },
    generatedAt: new Date().toISOString(),
    days,
    view,
    availableViews,
    sources: [...new Set(rows.map((r) => r.source))],
    summary: {
      referringDomains: latest?.referringDomains ?? null,
      referringDomainsChange: latest && first && latest !== first ? latest.referringDomains - first.referringDomains : null,
      backlinks: latest?.backlinks ?? null,
      domainRank: latest?.domainRank ?? null,
      dofollowShare: typed.length ? typed.filter((l) => l.dofollow).length / typed.length : null,
      newCount: rows.filter((l) => l.isNew && !l.isLost).length,
      lostCount: rows.filter((l) => l.isLost).length,
      sampleSize: rows.length,
    },
    history: snapshots.map((s) => ({ date: toDateKey(s.capturedAt), referringDomains: s.referringDomains })),
    anchors: [...anchorCounts].map(([anchor, count]) => ({ anchor, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    topDomains: [...domainStats]
      .map(([domain, s]) => ({ domain, ...s }))
      .sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1) || b.links - a.links)
      .slice(0, 15),
    links: rows.map((l) => ({
      id: l.id,
      urlFrom: l.urlFrom,
      urlTo: l.urlTo,
      domainFrom: l.domainFrom,
      anchor: l.anchor,
      dofollow: l.dofollow,
      domainFromRank: l.domainFromRank,
      firstSeen: l.firstSeen ? toDateKey(l.firstSeen) : null,
      lastSeen: l.lastSeen ? toDateKey(l.lastSeen) : null,
      isNew: l.isNew,
      isLost: l.isLost,
      source: l.source,
    })),
  };
}

export function getGscQueries(projectId: string) {
  return db.searchConsoleQuery.findMany({ where: { projectId }, orderBy: { clicks: "desc" }, take: 500 });
}
