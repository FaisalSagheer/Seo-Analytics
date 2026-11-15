import "server-only";
import { db } from "@/lib/db";
import { toDateKey } from "@/lib/dates";

export type BacklinkSite = {
  site: string;
  linkingPages: number;
  targetPages: number | null;
  /** Linking pages minus the previous upload's; null when there is no earlier upload */
  change: number | null;
  /** Not in the previous upload */
  isNew: boolean;
};

export type BacklinkImportView = { id: string; asOf: string; createdAt: string; counts: Record<"SITE" | "PAGE" | "TEXT", number> };

export type BacklinkReport = {
  imports: BacklinkImportView[];
  /** The upload the site list comes from, and the one before it that it is compared with */
  sitesAsOf: string | null;
  previousAsOf: string | null;
  sites: BacklinkSite[];
  lost: { site: string; linkingPages: number }[];
  totals: { sites: number; linkingPages: number; newSites: number; lostSites: number; previousSites: number | null };
  pagesAsOf: string | null;
  pages: { url: string; incomingLinks: number; linkingSites: number | null }[];
  textsAsOf: string | null;
  texts: { text: string; links: number }[];
  history: { date: string; sites: number; linkingPages: number }[];
};

/**
 * Backlinks as Search Console reports them. Each upload is a snapshot; comparing the latest
 * list of linking sites with the one before it is what shows new and lost links.
 */
export async function getBacklinkReport(projectId: string): Promise<BacklinkReport> {
  const [imports, agg] = await Promise.all([
    db.linkImport.findMany({ where: { projectId }, orderBy: [{ asOf: "desc" }, { createdAt: "desc" }] }),
    db.linkImportRow.groupBy({ by: ["importId", "kind"], where: { import: { projectId } }, _count: { _all: true }, _sum: { links: true } }),
  ]);
  const stat = new Map(agg.map((a) => [`${a.importId}:${a.kind}`, { count: a._count._all, links: a._sum.links ?? 0 }]));
  const countOf = (id: string, kind: "SITE" | "PAGE" | "TEXT") => stat.get(`${id}:${kind}`)?.count ?? 0;

  const views: BacklinkImportView[] = imports.map((i) => ({
    id: i.id,
    asOf: toDateKey(i.asOf),
    createdAt: i.createdAt.toISOString(),
    counts: { SITE: countOf(i.id, "SITE"), PAGE: countOf(i.id, "PAGE"), TEXT: countOf(i.id, "TEXT") },
  }));
  const withKind = (kind: "SITE" | "PAGE" | "TEXT") => views.filter((v) => v.counts[kind] > 0);
  const siteImports = withKind("SITE");
  const latest = siteImports[0] ?? null;
  const prev = siteImports[1] ?? null;

  const [latestRows, prevRows] = await Promise.all([
    latest ? db.linkImportRow.findMany({ where: { importId: latest.id, kind: "SITE" } }) : [],
    prev ? db.linkImportRow.findMany({ where: { importId: prev.id, kind: "SITE" } }) : [],
  ]);
  const before = new Map(prevRows.map((r) => [r.label.toLowerCase(), r.links]));
  const sites: BacklinkSite[] = latestRows
    .map((r) => {
      const was = before.get(r.label.toLowerCase());
      return {
        site: r.label,
        linkingPages: r.links,
        targetPages: r.related,
        change: prev ? r.links - (was ?? 0) : null,
        isNew: Boolean(prev) && was === undefined,
      };
    })
    .sort((a, b) => b.linkingPages - a.linkingPages || a.site.localeCompare(b.site));
  const nowSet = new Set(latestRows.map((r) => r.label.toLowerCase()));
  const lost = prev ? prevRows.filter((r) => !nowSet.has(r.label.toLowerCase())).map((r) => ({ site: r.label, linkingPages: r.links })).sort((a, b) => b.linkingPages - a.linkingPages) : [];

  const pageImport = withKind("PAGE")[0] ?? null;
  const textImport = withKind("TEXT")[0] ?? null;
  const [pageRows, textRows] = await Promise.all([
    pageImport ? db.linkImportRow.findMany({ where: { importId: pageImport.id, kind: "PAGE" }, orderBy: { links: "desc" }, take: 100 }) : [],
    textImport ? db.linkImportRow.findMany({ where: { importId: textImport.id, kind: "TEXT" }, orderBy: { links: "desc" }, take: 50 }) : [],
  ]);

  // One point per date, oldest first; if two uploads share a date the newer one wins
  const byDate = new Map<string, { date: string; sites: number; linkingPages: number }>();
  for (const v of [...siteImports].reverse()) {
    byDate.set(v.asOf, { date: v.asOf, sites: v.counts.SITE, linkingPages: stat.get(`${v.id}:SITE`)?.links ?? 0 });
  }

  return {
    imports: views,
    sitesAsOf: latest?.asOf ?? null,
    previousAsOf: prev?.asOf ?? null,
    sites,
    lost,
    totals: {
      sites: sites.length,
      linkingPages: sites.reduce((s, x) => s + x.linkingPages, 0),
      newSites: sites.filter((s) => s.isNew).length,
      lostSites: lost.length,
      previousSites: prev ? prev.counts.SITE : null,
    },
    pagesAsOf: pageImport?.asOf ?? null,
    pages: pageRows.map((r) => ({ url: r.label, incomingLinks: r.links, linkingSites: r.related })),
    textsAsOf: textImport?.asOf ?? null,
    texts: textRows.map((r) => ({ text: r.label, links: r.links })),
    history: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
