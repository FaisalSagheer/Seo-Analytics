import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { TrendChart } from "@/components/charts/trend-chart";
import { PrintButton } from "@/components/backlinks/print-button";
import { TopAnchors } from "@/components/backlinks/top-anchors";
import { Skeleton } from "@/components/ui/skeleton";
import { getBacklinkStatus, getLinkTypeLabel, getSourceLabel, getViewLabel, parseBacklinkView } from "@/lib/backlinks";
import { parseRange } from "@/lib/dates";
import { formatDate, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import { getBacklinkReport, getProject } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Backlink report" };

async function Report({ params, searchParams }: PageProps<"/report/[projectId]/backlinks">) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await getProject(projectId, user.id);
  if (!project) notFound();
  const sp = await searchParams;
  const days = parseRange(sp.days, 180);
  const report = (await getBacklinkReport(project.id, days, parseBacklinkView(sp.source)))!;
  const { summary } = report;

  const kpis: [string, string][] = [
    ["Referring domains", formatNumber(summary.referringDomains)],
    [`Change, ${days} days`, summary.referringDomainsChange != null ? formatSigned(summary.referringDomainsChange) : "—"],
    ["Backlinks", formatNumber(summary.backlinks)],
    ["Domain rank", summary.domainRank != null ? `${summary.domainRank} / 100` : "—"],
    ["Dofollow share", formatPercent(summary.dofollowShare)],
    ["New / lost links", summary.sampleSize ? `${summary.newCount} / ${summary.lostCount}` : "—"],
  ];

  return (
    <article className="mx-auto flex max-w-5xl flex-col gap-8 p-6 md:p-10 print:max-w-none print:gap-6 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div className="flex flex-col gap-2">
          <AppLogo />
          <h1 className="text-3xl font-semibold tracking-tight">
            Backlink report <span className="text-muted-foreground font-normal">· {getViewLabel(report.view)}</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{project.domain}</span> · generated{" "}
            {formatDate(report.generatedAt.slice(0, 10), "long")} · history: last {days} days
            {report.sources.length > 0 && <> · source: {report.sources.map(getSourceLabel).join(", ")}</>}
          </p>
        </div>
        <PrintButton />
      </header>

      {project.isDemo && (
        <p className="rounded-lg border px-4 py-3 text-sm">This report uses generated demo data.</p>
      )}

      <section aria-labelledby="summary" className="flex flex-col gap-3 break-inside-avoid">
        <h2 id="summary" className="text-lg font-semibold">Summary</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {kpis.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 rounded-lg border p-4">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="history" className="flex flex-col gap-3 break-inside-avoid">
        <h2 id="history" className="text-lg font-semibold">Referring domains over time</h2>
        <TrendChart
          data={report.history}
          series={[{ key: "referringDomains", label: "Referring domains", color: "var(--chart-1)" }]}
          height={220}
          emptyMessage="No snapshots in this range yet."
        />
      </section>

      <div className="grid gap-8 md:grid-cols-2 print:grid-cols-2">
        <section aria-labelledby="anchors" className="flex flex-col gap-3 break-inside-avoid">
          <h2 id="anchors" className="text-lg font-semibold">Top anchor text</h2>
          <TopAnchors anchors={report.anchors} />
        </section>
        <section aria-labelledby="domains" className="flex flex-col gap-3 break-inside-avoid">
          <h2 id="domains" className="text-lg font-semibold">Top referring domains</h2>
          {report.topDomains.length === 0 ? (
            <p className="text-muted-foreground text-sm">No backlinks yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-1.5 font-medium">Domain</th>
                  <th className="py-1.5 text-right font-medium">Links</th>
                  <th className="py-1.5 text-right font-medium">Rank</th>
                </tr>
              </thead>
              <tbody>
                {report.topDomains.map((d) => (
                  <tr key={d.domain} className="border-b last:border-0">
                    <td className="py-1.5">{d.domain}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.links}</td>
                    <td className="py-1.5 text-right tabular-nums">{d.rank ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section aria-labelledby="links" className="flex flex-col gap-3">
        <h2 id="links" className="text-lg font-semibold">
          All backlinks <span className="text-muted-foreground text-sm font-normal">({report.links.length})</span>
        </h2>
        {report.links.length === 0 ? (
          <p className="text-muted-foreground text-sm">No backlinks loaded yet. Refresh the project&apos;s domain data first.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-1.5 pr-2 font-medium">Referring page</th>
                <th className="py-1.5 pr-2 text-right font-medium">DR</th>
                <th className="py-1.5 pr-2 font-medium">Anchor</th>
                <th className="py-1.5 pr-2 font-medium">Target</th>
                <th className="py-1.5 pr-2 font-medium">Type</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
                <th className="py-1.5 font-medium">First seen</th>
              </tr>
            </thead>
            <tbody>
              {report.links.map((l) => (
                <tr key={l.id} className="border-b align-top break-inside-avoid last:border-0">
                  <td className="py-1.5 pr-2 break-all">{l.urlFrom.replace(/^https?:\/\//, "")}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{l.domainFromRank ?? "—"}</td>
                  <td className="py-1.5 pr-2">{l.anchor || "(no anchor)"}</td>
                  <td className="py-1.5 pr-2 break-all">{l.urlTo.replace(/^https?:\/\/[^/]+/, "") || "/"}</td>
                  <td className="py-1.5 pr-2">{getLinkTypeLabel(l.dofollow)}</td>
                  <td className="py-1.5 pr-2">{getBacklinkStatus(l).label}</td>
                  <td className="py-1.5 whitespace-nowrap">{l.firstSeen ? formatDate(l.firstSeen, "long") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="text-muted-foreground border-t pt-4 text-xs">
        Generated by Seo Engine. Domain rank and link types come from the data source; Bing Webmaster Tools doesn&apos;t report them.
      </footer>
    </article>
  );
}

export default function BacklinkReportPage(props: PageProps<"/report/[projectId]/backlinks">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex max-w-5xl flex-col gap-6 p-10">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <Report {...props} />
    </Suspense>
  );
}
