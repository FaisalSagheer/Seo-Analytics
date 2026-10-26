import type { Metadata } from "next";
import { TrendChart } from "@/components/charts/trend-chart";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { MoversCard } from "@/components/dashboard/movers-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseRange } from "@/lib/dates";
import { formatNumber, formatPercent, formatPosition, formatRelative } from "@/lib/format";
import { getProjectReport } from "@/lib/queries";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ params, searchParams }: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days);
  const report = (await getProjectReport(project.id, days))!;
  const { totals, series } = report;

  const hasGoogle = totals.clicks > 0 || totals.sessions > 0;
  const conversionRate = totals.sessions > 0 ? totals.conversions / totals.sessions : null;

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.domain} · synced ${formatRelative(project.lastSyncedAt)}`}
        actions={
          <>
            <RangePicker value={days} />
            <SyncButton projectId={project.id} />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          label="Visibility"
          value={totals.visibility != null ? `${totals.visibility.toFixed(1)}%` : "—"}
          delta={totals.visibilityChange}
          deltaDigits={1}
          hint="Share of clicks at #1 for every keyword"
        />
        <StatCard label="Avg. position" value={formatPosition(totals.avgPosition != null ? Number(totals.avgPosition.toFixed(1)) : null)} hint={`${totals.trackedKeywords} keywords tracked`} />
        <StatCard label="Top 3" value={formatNumber(totals.top3)} hint={`Top 10: ${formatNumber(totals.top10)}`} />
        <StatCard label="Organic clicks" value={formatNumber(totals.clicks)} hint={`${formatNumber(totals.impressions)} impressions`} />
        <StatCard label="Organic sessions" value={formatNumber(totals.sessions)} hint="GA4, organic search" />
        <StatCard label="Key events" value={formatNumber(totals.conversions)} hint={`${formatPercent(conversionRate)} of sessions`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organic clicks and sessions</CardTitle>
          <CardDescription>Search Console clicks next to GA4 organic sessions, per day.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={series}
            series={[
              { key: "clicks", label: "Clicks (GSC)", color: "var(--chart-1)" },
              { key: "sessions", label: "Sessions (GA4)", color: "var(--chart-2)" },
            ]}
            height={280}
            emptyMessage={
              hasGoogle ? "No traffic in this range." : "Connect Google in Settings and pick a Search Console site and GA4 property."
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average position</CardTitle>
            <CardDescription>Mean rank of tracked keywords that rank. Higher on the chart is better.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={series}
              series={[{ key: "avgPosition", label: "Avg. position", color: "var(--chart-1)" }]}
              format="position"
              reversed
              emptyMessage="Add keywords and refresh to start the history."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
            <CardDescription>Volume-weighted expected CTR, as a share of holding #1 everywhere.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={series}
              series={[{ key: "visibility", label: "Visibility %", color: "var(--chart-3)" }]}
              format="score"
              emptyMessage="Add keywords and refresh to start the history."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MoversCard
          title="Biggest gains"
          description={`Position change over the last ${days} days`}
          rows={report.movers.up}
          projectId={project.id}
        />
        <MoversCard
          title="Biggest drops"
          description={`Position change over the last ${days} days`}
          rows={report.movers.down}
          projectId={project.id}
        />
      </div>
    </>
  );
}
