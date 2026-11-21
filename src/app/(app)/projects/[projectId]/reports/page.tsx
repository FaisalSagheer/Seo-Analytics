import type { Metadata } from "next";
import Link from "next/link";
import { PlugIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { Ga4Report, type Ga4Row } from "@/components/performance/ga4-report";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, compareWindow, resolveCompare, resolveRange } from "@/lib/date-range";
import { toDateKey } from "@/lib/dates";
import { formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { hourRow, loadAnalyticsReport } from "@/lib/analytics-live";
import { MAX_HOURLY_DAYS } from "@/lib/search-console-live";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

/** Totals across the channel rows: users aren't additive across channels, so they're left out. */
function totalsOf(rows: { sessions: number; engagementRate: number; conversions: number }[]) {
  const sessions = rows.reduce((s, r) => s + r.sessions, 0);
  const engaged = rows.reduce((s, r) => s + r.engagementRate * r.sessions, 0);
  return { sessions, engagementRate: sessions ? engaged / sessions : 0, conversions: rows.reduce((s, r) => s + r.conversions, 0) };
}

export default async function ReportsPage({ params, searchParams }: PageProps<"/projects/[projectId]/reports">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;

  const range = resolveRange(sp, 28);
  const { days } = range;
  const compareSpec = resolveCompare(sp, range);
  // A 24 hour range covers yesterday and today
  const shown = days === 1 ? { start: addDays(range.end, -1), end: range.end } : range;
  const cmpWindow = compareWindow(compareSpec, shown);
  // Hourly data is short-lived, so the 24 hour range is the hourly one
  const canHourly = !range.custom && days <= MAX_HOURLY_DAYS && Boolean(project.ga4PropertyId) && !project.isDemo;
  // Hourly is automatic: the 24 hour range shows hours, everything longer shows days
  const hourly = canHourly && days === 1;

  const report = project.isDemo
    ? { data: null, hourly: null, note: "Demo projects have no live Google Analytics data." }
    : await loadAnalyticsReport(project, { window: range, days, compare: cmpWindow, hourly });

  const channels = report.data?.channels ?? [];
  const cur = totalsOf(channels);
  const prev = channels.length && channels.every((r) => r.previous) ? totalsOf(channels.map((r) => r.previous!)) : null;
  const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : null);
  const hint = prev ? { previous: "vs previous period", year: "vs same period last year", week: "vs same hours last week", custom: "vs custom period", none: "" }[compareSpec.kind] : undefined;
  const hourRows: Ga4Row[] | null = report.hourly ? [...report.hourly].reverse().map(hourRow) : null;
  const lastHour = report.hourly?.length ? new Date(report.hourly[report.hourly.length - 1].date) : null;

  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <>
            {lastHour && <span className="text-muted-foreground hidden text-sm sm:inline">Last hour with data: {formatRelative(lastHour)}</span>}
            <RangePicker
              value={days}
              advanced
              custom={range.custom ? { from: toDateKey(range.start), to: toDateKey(range.end) } : undefined}
              compare={{
                kind: compareSpec.kind,
                from: compareSpec.custom ? toDateKey(compareSpec.custom.start) : undefined,
                to: compareSpec.custom ? toDateKey(compareSpec.custom.end) : undefined,
              }}
            />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}
      {!project.isDemo && !project.ga4PropertyId && (
        <Alert>
          <PlugIcon />
          <AlertTitle>Google Analytics isn&apos;t connected for this project</AlertTitle>
          <AlertDescription>Link a Google account, then choose a GA4 property.</AlertDescription>
          <AlertAction>
            <Link href={`/projects/${project.id}/settings`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              Project settings
            </Link>
          </AlertAction>
        </Alert>
      )}
      {report.hourlyError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t read hourly Google Analytics data</AlertTitle>
          <AlertDescription>{report.hourlyError}</AlertDescription>
        </Alert>
      )}

      {report.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Sessions" value={formatNumber(cur.sessions)} delta={prev ? pct(cur.sessions, prev.sessions) : undefined} deltaSuffix="%" hint={hint} />
          <StatCard
            label="Engagement rate"
            value={formatPercent(cur.engagementRate)}
            delta={prev ? (cur.engagementRate - prev.engagementRate) * 100 : undefined}
            deltaSuffix=" pp"
            deltaDigits={1}
            hint={hint}
          />
          <StatCard label="Conversions" value={formatNumber(cur.conversions)} delta={prev ? pct(cur.conversions, prev.conversions) : undefined} deltaSuffix="%" hint={hint} />
        </div>
      )}

      {report.hourly && (
        <Card>
          <CardHeader>
            <CardTitle>Organic sessions per hour</CardTitle>
            <CardDescription>Hours follow the GA4 property&apos;s time zone.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              hourly
              hourZone=""
              data={report.hourly}
              series={[{ key: "sessions", label: "Sessions", color: "var(--chart-3)" }]}
              height={220}
              emptyMessage="Google Analytics has no hourly sessions for this range yet."
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Channels covers all traffic; landing pages, countries and devices are organic search only
            {cmpWindow ? ", with the change from the comparison period under each number" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Ga4Report data={report.data} hourly={hourRows} note={report.note} />
        </CardContent>
      </Card>
    </>
  );
}
