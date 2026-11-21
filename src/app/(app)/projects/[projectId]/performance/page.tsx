import type { Metadata } from "next";
import Link from "next/link";
import { PlugIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { ProjectCountrySelect } from "@/components/projects/project-country-select";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { SearchParamSelect } from "@/components/dashboard/search-param-select";
import { resolveCompare, resolveRange, spanDays } from "@/lib/date-range";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { QueriesTable, type QueryRow } from "@/components/performance/queries-table";
import { SearchReport, type SearchReportData } from "@/components/performance/search-report";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { daysAgo, groupSeries, toDateKey } from "@/lib/dates";
import { formatNumber, formatPercent, formatPosition, formatRelative } from "@/lib/format";
import { MAX_HOURLY_DAYS, loadLiveReport } from "@/lib/search-console-live";
import { getGscQueries, getProjectReport, getRankingRows } from "@/lib/queries";
import { gscBreakdown, type GscBreakdownRow } from "@/lib/providers/google";
import { getGoogleAccessToken } from "@/lib/providers";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Performance" };

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/_/g, " ");
const toRows = (rows: GscBreakdownRow[], name: (key: string) => string = (k) => k) =>
  rows.map((r) => ({
    label: name(r.key),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));

/** The Pages, Countries, Devices and Search appearance reports, read from Search Console for the chosen range. */
async function loadSearchReport(project: { id: string; userId: string; gscSiteUrl: string | null }, range: { start: Date; end: Date }) {
  if (!project.gscSiteUrl)
    return {
      data: null,
      note: "Choose a Search Console site in project settings.",
    };
  try {
    const token = await getGoogleAccessToken(project);
    const start = toDateKey(range.start);
    const end = toDateKey(range.end);
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
    return {
      data: null,
      note: `Couldn't load Search Console: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

export default async function PerformancePage({ params, searchParams }: PageProps<"/projects/[projectId]/performance">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;
  const range = resolveRange(sp, 90);
  const { days } = range;
  const compareSpec = resolveCompare(sp, range);
  // Search Console keeps hourly data only briefly, so only the 24 hour and 7 day presets offer hourly
  const canHourly = !range.custom && days <= MAX_HOURLY_DAYS && Boolean(project.gscSiteUrl) && !project.isDemo;
  // 24 hours defaults to hourly; otherwise the Granularity choice (hourly only where Google keeps hourly data)
  const by = sp.by === "hour" || sp.by === "week" || sp.by === "month" ? sp.by : sp.by === "day" ? "day" : days === 1 ? "hour" : "day";
  const hourly = canHourly && by === "hour";
  const bucket = by === "week" || by === "month" ? by : undefined;
  // Synced data covers about 90 days; longer or older ranges are read live
  const wantDaily = !project.isDemo && Boolean(project.gscSiteUrl) && (range.custom ? range.start < daysAgo(89) : days > 90);
  const live = project.isDemo ? null : await loadLiveReport(project, { window: range, days, hourly, compare: compareSpec, wantDaily });
  // How far back from today the range starts, for the keyword history behind the charts
  const sinceDays = spanDays({ start: range.start, end: daysAgo(0) });

  const [report, queries, rankings, gscAgg, gaAgg] = await Promise.all([
    getProjectReport(project.id, sinceDays, { from: range.start, to: range.end }),
    getGscQueries(project.id),
    getRankingRows(project.id, 28),
    db.searchConsoleDaily.aggregate({
      where: { projectId: project.id, date: { gte: range.start, lte: range.end } },
      _sum: { clicks: true, impressions: true },
      _avg: { position: true },
    }),
    db.analyticsDaily.aggregate({
      where: { projectId: project.id, date: { gte: range.start, lte: range.end } },
      _avg: { engagementRate: true },
    }),
  ]);
  const searchReport = project.isDemo ? { data: null, note: "Demo projects have no live Search Console data." } : await loadSearchReport(project, range);
  const liveDay = new Map((live?.daily ?? []).map((d) => [d.date, d]));
  const daily = report!.series.map((p) => {
    const d = liveDay.get(p.date);
    return { ...p, clicks: d ? d.clicks : p.clicks, impressions: d ? d.impressions : p.impressions };
  });
  // Weekly / monthly: counts add up, position and visibility average; CTR is worked out after grouping
  const grouped = bucket ? groupSeries(daily, bucket, ["clicks", "impressions", "sessions", "conversions"], ["avgPosition", "visibility"]) : daily;
  const series = grouped.map((p) => ({ ...p, ctr: p.clicks != null && p.impressions ? p.clicks / p.impressions : null }));
  const totals = report!.totals;

  // Live Search Console totals win when the page is hourly or comparing, so both periods come from the same source
  const clicks = live?.current?.clicks ?? gscAgg._sum.clicks ?? 0;
  const impressions = live?.current?.impressions ?? gscAgg._sum.impressions ?? 0;
  const position = live?.current ? live.current.position : gscAgg._avg.position;
  const prev = live?.current ? live.previous : null;
  const pct = (cur: number, before: number | undefined) => (before ? ((cur - before) / before) * 100 : null);
  const compareHint = prev
    ? { previous: "vs previous period", year: "vs same period last year", week: "vs same hours last week", custom: "vs custom period", none: "" }[
        compareSpec.kind
      ]
    : undefined;
  const lastUpdate = hourly && live?.lastDataAt ? live.lastDataAt : project.lastSyncedAt;
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
        actions={
          <>
            <span className="text-muted-foreground hidden text-sm sm:inline">Last update: {formatRelative(lastUpdate)}</span>
            <ProjectCountrySelect projectId={project.id} locationCode={project.locationCode} />
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
            <SearchParamSelect
              param="by"
              label="Granularity"
              value={hourly ? "hour" : by === "hour" ? "day" : by}
              items={[
                { value: "hour", label: "Hourly", disabled: !canHourly },
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
                { value: "month", label: "Monthly" },
              ]}
            />
            <SyncButton projectId={project.id} parts={["google"]} label="Sync Google" />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}
      {live?.error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t read live Search Console data</AlertTitle>
          <AlertDescription>{live.error}</AlertDescription>
        </Alert>
      )}
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
        <StatCard label="Clicks" value={formatNumber(clicks)} delta={prev ? pct(clicks, prev.clicks) : undefined} deltaSuffix="%" hint={compareHint} />
        <StatCard
          label="Impressions"
          value={formatNumber(impressions)}
          delta={prev ? pct(impressions, prev.impressions) : undefined}
          deltaSuffix="%"
          hint={compareHint}
        />
        <StatCard
          label="CTR"
          value={formatPercent(impressions ? clicks / impressions : null)}
          delta={prev && impressions ? (clicks / impressions - prev.ctr) * 100 : prev ? null : undefined}
          deltaSuffix=" pp"
          deltaDigits={1}
          hint={compareHint}
        />
        <StatCard
          label="GSC avg. position"
          value={formatPosition(position != null ? Number(position.toFixed(1)) : null)}
          delta={prev && position != null ? prev.position - position : prev ? null : undefined}
          deltaDigits={1}
          hint={compareHint}
        />
        <StatCard label="Organic sessions" value={formatNumber(totals.sessions)} />
        <StatCard label="Engagement rate" value={formatPercent(gaAgg._avg.engagementRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Traffic</CardTitle>
          <CardDescription>
            Clicks from Search Console and organic sessions from GA4. In the hourly view, Search Console hours are UTC and GA4 hours follow the property time
            zone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {live?.hourly ? (
            <>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Clicks per hour (UTC)</h3>
                    <TrendChart
                      syncId="hourly"
                      hourly
                      data={live.hourly}
                      series={[{ key: "clicks", label: "Clicks", color: "var(--chart-1)" }]}
                      height={200}
                      emptyMessage="Search Console has no hourly data for this range yet."
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Impressions per hour (UTC)</h3>
                    <TrendChart
                      syncId="hourly"
                      hourly
                      data={live.hourly}
                      series={[
                        {
                          key: "impressions",
                          label: "Impressions",
                          color: "var(--chart-2)",
                        },
                      ]}
                      height={200}
                      emptyMessage="Search Console has no hourly data for this range yet."
                    />
                  </div>
            </>
          ) : (
            <>
              <TrendChart
                syncId="perf"
                data={series} bucket={bucket}
                series={[
                  {
                    key: "clicks",
                    label: "Clicks (GSC)",
                    color: "var(--chart-1)",
                  },
                  {
                    key: "sessions",
                    label: "Sessions (GA4)",
                    color: "var(--chart-2)",
                  },
                ]}
                height={240}
              />
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Click-through rate</h3>
                  <TrendChart syncId="perf" data={series} bucket={bucket} series={[{ key: "ctr", label: "CTR", color: "var(--chart-3)" }]} format="percent" height={180} />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">Tracked keywords, avg. position</h3>
                  <TrendChart
                    syncId="perf"
                    data={series} bucket={bucket}
                    series={[
                      {
                        key: "avgPosition",
                        label: "Avg. position",
                        color: "var(--chart-4)",
                      },
                    ]}
                    format="position"
                    reversed
                    height={180}
                  />
                </div>
              </div>
            </>
          )}
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
