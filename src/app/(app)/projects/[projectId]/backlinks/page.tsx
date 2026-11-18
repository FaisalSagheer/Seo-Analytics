import type { Metadata } from "next";
import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { LinkImportCard } from "@/components/backlinks/import-card";
import { LinkImportHistory } from "@/components/backlinks/import-history";
import { Delta } from "@/components/dashboard/delta";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { PagedList, PagedTable } from "@/components/performance/table-pager";
import { getBacklinkReport } from "@/lib/backlinks";
import { formatDate, formatNumber } from "@/lib/format";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Backlinks" };

function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export default async function BacklinksPage({ params }: PageProps<"/projects/[projectId]/backlinks">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const report = await getBacklinkReport(project.id);
  const { totals } = report;
  const compared = report.previousAsOf != null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Backlinks"
        description={`Sites that link to ${project.domain}, from Search Console's Links report. Google offers no API for it, so you upload the export.`}
      />
      {project.isDemo && <DemoAlert />}
      <LinkImportCard projectId={project.id} domain={project.domain} today={today} />

      {report.imports.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon />
            </EmptyMedia>
            <EmptyTitle>No links imported yet</EmptyTitle>
            <EmptyDescription>Export the Links report from Search Console and upload it above. Each upload is a snapshot, and the next one shows which sites were gained or lost.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Linking sites"
              value={report.sitesAsOf ? formatNumber(totals.sites) : "—"}
              delta={totals.previousSites != null ? totals.sites - totals.previousSites : undefined}
              hint={report.sitesAsOf ? `As of ${formatDate(report.sitesAsOf, "long")}` : "No top linking sites table imported"}
            />
            <StatCard label="Linking pages" value={report.sitesAsOf ? formatNumber(totals.linkingPages) : "—"} hint="Across the sites listed" />
            <StatCard label="New sites" value={compared ? formatNumber(totals.newSites) : "—"} hint={compared ? `Since ${formatDate(report.previousAsOf!, "long")}` : "Needs two imports to compare"} />
            <StatCard label="Lost sites" value={compared ? formatNumber(totals.lostSites) : "—"} hint={compared ? `Since ${formatDate(report.previousAsOf!, "long")}` : "Needs two imports to compare"} />
          </div>

          {report.history.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Linking sites over time</CardTitle>
                <CardDescription>One point per import.</CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={report.history}
                  series={[{ key: "sites", label: "Linking sites", color: "var(--chart-1)" }]}
                  height={220}
                />
              </CardContent>
            </Card>
          )}

          {report.sitesAsOf && (
            <Card>
              <CardHeader>
                <CardTitle>Linking sites</CardTitle>
                <CardDescription>Most links first. Search Console lists only your top linking sites, not every one.</CardDescription>
              </CardHeader>
              <CardContent>
                <PagedTable header={<>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead className="text-right">Linking pages</TableHead>
                      <TableHead className="text-right">Your pages linked</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                  </>} rows={report.sites.slice(0, 200).map((s) => (
                      <TableRow key={s.site}>
                        <TableCell className="max-w-80">
                          <span className="flex items-center gap-2">
                            <a href={`https://${s.site}`} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-1 hover:underline">
                              <span className="truncate">{s.site}</span>
                              <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                            </a>
                            {s.isNew && <Badge variant="secondary">New</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.linkingPages)}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.targetPages != null ? formatNumber(s.targetPages) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Delta value={s.change} />
                        </TableCell>
                      </TableRow>
                    ))} />
              </CardContent>
            </Card>
          )}

          {report.lost.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Lost sites</CardTitle>
                <CardDescription>In the {formatDate(report.previousAsOf!, "long")} import and missing from the latest. The link may be gone, or have dropped out of Google&apos;s top list.</CardDescription>
              </CardHeader>
              <CardContent>
                <PagedList className="divide-y" items={report.lost.slice(0, 50).map((l) => (
                    <li key={l.site} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="truncate">{l.site}</span>
                      <span className="text-muted-foreground text-sm tabular-nums">{formatNumber(l.linkingPages)} linking pages before</span>
                    </li>
                  ))} />
              </CardContent>
            </Card>
          )}

          {report.pages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Most linked pages</CardTitle>
                <CardDescription>Your pages with the most incoming links{report.pagesAsOf ? `, as of ${formatDate(report.pagesAsOf, "long")}` : ""}.</CardDescription>
              </CardHeader>
              <CardContent>
                <PagedTable header={<>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right">Incoming links</TableHead>
                      <TableHead className="text-right">Linking sites</TableHead>
                    </TableRow>
                  </>} rows={report.pages.map((p) => {
                      const href = safeHref(p.url);
                      return (
                        <TableRow key={p.url}>
                          <TableCell className="max-w-xl">
                            {href ? (
                              <a href={href} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 hover:underline">
                                <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                                <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="truncate">{p.url}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.incomingLinks)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.linkingSites != null ? formatNumber(p.linkingSites) : "—"}</TableCell>
                        </TableRow>
                      );
                    })} />
              </CardContent>
            </Card>
          )}

          {report.texts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top linking text</CardTitle>
                <CardDescription>The anchor text other sites use{report.textsAsOf ? `, as of ${formatDate(report.textsAsOf, "long")}` : ""}.</CardDescription>
              </CardHeader>
              <CardContent>
                <PagedTable header={<>
                    <TableRow>
                      <TableHead>Text</TableHead>
                      <TableHead className="text-right">Links</TableHead>
                    </TableRow>
                  </>} rows={report.texts.map((t) => (
                      <TableRow key={t.text}>
                        <TableCell className="max-w-xl truncate">{t.text}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(t.links)}</TableCell>
                      </TableRow>
                    ))} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Import history</CardTitle>
              <CardDescription>The 24 most recent imports are kept.</CardDescription>
            </CardHeader>
            <CardContent>
              <LinkImportHistory projectId={project.id} imports={report.imports} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
