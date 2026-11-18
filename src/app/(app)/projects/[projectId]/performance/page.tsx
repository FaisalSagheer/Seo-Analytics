import type { Metadata } from "next";
import Link from "next/link";
import { PlugIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { QueriesTable, type QueryRow } from "@/components/performance/queries-table";
import { SearchReport, type SearchReportData } from "@/components/performance/search-report";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { daysAgo, parseRange, toDateKey } from "@/lib/dates";
import { formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { getGscQueries, getProjectReport, getRankingRows } from "@/lib/queries";
import { gscBreakdown, type GscBreakdownRow } from "@/lib/providers/google";
import { getGoogleAccessToken } from "@/lib/providers";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Performance" };

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");
const toRows = (rows: GscBreakdownRow[], name: (key: string) => string = (k) => k) =>
  rows.map((r) => ({ label: name(r.key), clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));

/** The Pages, Countries, Devices and Search appearance reports, read from Search Console for the chosen range. */
async function loadSearchReport(project: { id: string; userId: string; gscSiteUrl: string | null }, days: number) {
  if (!project.gscSiteUrl) return { data: null, note: "Choose a Search Console site in project settings." };
  try {
    const token = await getGoogleAccessToken(project);
    const start = toDateKey(daysAgo(days));
    const end = toDateKey(daysAgo(0));
    const site = project.gscSiteUrl;
    const [pages, countries, devices, appearance] = await Promise.all(
      (["page", "country", "device", "searchAppearance"] as const).map((d) => gscBreakdown(token, site, d, start, end)),
    );
    const data: SearchReportData = {
      pages: toRows(pages),
      countries: toRows(countries, (k) => k.toUpperCase()),
      devices: toRows(devices, label),
      appearance: toRows(appearance, label),
    };
    return { data, note: undefined };
  } catch (err) {
    return { data: null, note: `Couldn't load Search Console: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

export default async function PerformancePage({ params, searchParams }: PageProps<"/projects/[projectId]/performance">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days, 90);

  const [report, queries, rankings, gscAgg, gaAgg] = await Promise.all([
    getProjectReport(project.id, days),
    getGscQueries(project.id),
    getRankingRows(project.id, 28),
    db.searchConsoleDaily.aggregate({
      where: { projectId: project.id, date: { gte: daysAgo(days - 1) } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    db.analyticsDaily.aggregate({
      where: { projectId: project.id, date: { gte: daysAgo(days - 1) } },
      _avg: { engagementRate: true },
    }),
  ]);
  const searchReport = project.isDemo ? { data: null, note: "Demo projects have no live Search Console data." } : await loadSearchReport(project, days);
  const series = report!.series.map((p) => ({ ...p, ctr: p.clicks != null && p.impressions ? p.clicks / p.impressions : null }));
  const totals = report!.totals;

  const clicks = gscAgg._sum.clicks ?? 0;
  const impressions = gscAgg._sum.impressions ?? 0;
  const connected = project.isDemo || Boolean(project.gscSiteUrl || project.ga4PropertyId);

  const tracked = new Map(rankings.map((r) => [r.phrase, r]));
  const rows: QueryRow[] = queries.map((q) => {
    const t = tracked.get(q.query.toLowerCase());
    return {
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.ctr,
      gscPosition: q.position,
      tracked: t ? { position: t.position, change: t.change } : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Performance"
        description="Search Console, GA4 and tracked rankings on one timeline."
        actions={
          <>
            <RangePicker value={days} />
            <SyncButton projectId={project.id} parts={["google"]} label="Sync Google" />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}
      {!connected && (
        <Alert>
          <PlugIcon />
          <AlertTitle>Google isn&apos;t connected for this project</AlertTitle>
          <AlertDescription>Link a Google account, then choose a Search Console site and GA4 property.</AlertDescription>
          <AlertAction>
            <Link href={`/projects/${project.id}/settings`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              Project settings
            </Link>
          </AlertAction>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Clicks" value={formatNumber(clicks)} />
        <StatCard label="Impressions" value={formatNumber(impressions)} />
        <StatCard label="CTR" value={formatPercent(impressions ? clicks / impressions : null)} />
        <StatCard label="GSC avg. position" value={formatPosition(gscAgg._avg.position != null ? Number(gscAgg._avg.position.toFixed(1)) : null)} />
        <StatCard label="Organic sessions" value={formatNumber(totals.sessions)} />
        <StatCard label="Engagement rate" value={formatPercent(gaAgg._avg.engagementRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Traffic</CardTitle>
          <CardDescription>Clicks from Search Console and organic sessions from GA4. Hover one chart to read all three.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <TrendChart
            syncId="perf"
            data={series}
            series={[
              { key: "clicks", label: "Clicks (GSC)", color: "var(--chart-1)" },
              { key: "sessions", label: "Sessions (GA4)", color: "var(--chart-2)" },
            ]}
            height={240}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Click-through rate</h3>
              <TrendChart
                syncId="perf"
                data={series}
                series={[{ key: "ctr", label: "CTR", color: "var(--chart-3)" }]}
                format="percent"
                height={180}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Tracked keywords, avg. position</h3>
              <TrendChart
                syncId="perf"
                data={series}
                series={[{ key: "avgPosition", label: "Avg. position", color: "var(--chart-4)" }]}
                format="position"
                reversed
                height={180}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search results</CardTitle>
          <CardDescription>
            The same reports as Search Console. Queries are the last 28 days, with your tracked rank beside each; the other tabs follow the range above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SearchReport
            data={searchReport.data}
            note={searchReport.note}
            queries={
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground text-sm">Striking-distance queries sit at positions 4–20 with real demand.</p>
                <QueriesTable projectId={project.id} rows={rows} />
              </div>
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
