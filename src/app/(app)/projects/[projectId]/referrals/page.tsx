import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon, Link2Icon, PlugIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { ReferralsExport } from "@/components/referrals/export-button";
import { Delta } from "@/components/dashboard/delta";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { PagedList, PagedTable } from "@/components/performance/table-pager";
import { parseRange } from "@/lib/dates";
import { formatDate, formatNumber } from "@/lib/format";
import { getReferralReport } from "@/lib/referrals";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Referrals" };

/** Only http(s) links are ever rendered as links; anything else shows as text. */
function safeHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export default async function ReferralsPage({ params, searchParams }: PageProps<"/projects/[projectId]/referrals">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days, 28);
  const report = await getReferralReport(project.id, days);
  const { totals } = report;
  const noProperty = !project.isDemo && !project.ga4PropertyId;

  return (
    <>
      <PageHeader
        title="Referrals"
        actions={
          <>
            <RangePicker value={days} />
            {report.sites.length > 0 && <ReferralsExport domain={project.domain} days={days} sites={report.sites} />}
            <SyncButton projectId={project.id} parts={["google"]} label="Sync Google" />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}
      {noProperty && (
        <Alert>
          <PlugIcon />
          <AlertTitle>No GA4 property selected</AlertTitle>
          <AlertDescription>Referral links come from Google Analytics. Choose this project&apos;s GA4 property, then sync.</AlertDescription>
          <AlertAction>
            <Link href={`/projects/${project.id}/settings`} className={buttonVariants({ size: "sm", variant: "outline" })}>
              Project settings
            </Link>
          </AlertAction>
        </Alert>
      )}

      {!report.hasData ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2Icon />
            </EmptyMedia>
            <EmptyTitle>No referral traffic yet</EmptyTitle>
            <EmptyDescription>
              {noProperty
                ? "Pick a GA4 property for this project to start tracking which sites send visitors."
                : "Run Sync Google to pull the last 6 months. If it stays empty, no other website has sent this site a visit in that time."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              label="Referral sessions"
              value={formatNumber(totals.sessions)}
              delta={totals.previousSessions != null ? totals.sessions - totals.previousSessions : undefined}
              hint={report.comparable ? `vs the previous ${days} days` : undefined}
            />
            <StatCard label="Referring sites" value={formatNumber(totals.sites)} />
            <StatCard label="New sites" value={formatNumber(totals.newSites)} hint="First visit in this range" />
            <StatCard label="Gone quiet" value={report.comparable ? formatNumber(totals.goneSites) : "—"} hint={report.comparable ? "Sent visits before, none now" : "Pick 7 days, 28 days or 3 months to compare"} />
            <StatCard label="Conversions" value={formatNumber(totals.conversions)} hint="Key events from referrals" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Visits from other sites</CardTitle>
              <CardDescription>GA4 sessions in the Referral channel, per day.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={report.series} series={[{ key: "sessions", label: "Referral sessions", color: "var(--chart-1)" }]} height={220} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Referring sites</CardTitle>
              <CardDescription>Busiest first. New marks a site whose first visit falls inside the selected range.</CardDescription>
            </CardHeader>
            <CardContent>
              <PagedTable header={<>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead>First seen</TableHead>
                  </TableRow>
                </>} empty={{ columns: 6, text: "No site sent a visit in this range." }} rows={report.sites.slice(0, 100).map((s) => (
                      <TableRow key={s.source}>
                        <TableCell className="max-w-72">
                          <span className="flex items-center gap-2">
                            <a href={`https://${s.source}`} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-1 hover:underline">
                              <span className="truncate">{s.source}</span>
                              <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                            </a>
                            {s.isNew && <Badge variant="secondary">New</Badge>}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.sessions)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.users)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(s.conversions)}</TableCell>
                        <TableCell className="text-right">
                          <Delta value={s.previous != null ? s.sessions - s.previous : null} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(s.firstSeen, "long")}</TableCell>
                      </TableRow>
                    ))} />
            </CardContent>
          </Card>

          {report.gone.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Gone quiet</CardTitle>
                <CardDescription>These sites sent visits in the previous {days} days and none in this range. The link may have been removed, or just stopped getting clicks.</CardDescription>
              </CardHeader>
              <CardContent>
                <PagedList className="divide-y" items={report.gone.slice(0, 20).map((g) => (
                    <li key={g.source} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <a href={`https://${g.source}`} target="_blank" rel="noreferrer noopener" className="truncate hover:underline">
                        {g.source}
                      </a>
                      <span className="text-muted-foreground text-sm tabular-nums">{formatNumber(g.previous)} sessions before</span>
                    </li>
                  ))} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Referring pages, last 28 days</CardTitle>
              <CardDescription>The exact pages those visits came from. A page you can open and check for the link.</CardDescription>
            </CardHeader>
            <CardContent>
              <PagedTable header={<>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                  </TableRow>
                </>} empty={{ columns: 3, text: "No referring pages yet. Run Sync Google." }} rows={report.pages.map((p) => {
                      const href = safeHref(p.referrer);
                      return (
                        <TableRow key={p.referrer}>
                          <TableCell className="max-w-xl">
                            {href ? (
                              <a href={href} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 hover:underline">
                                <span className="truncate">{p.referrer.replace(/^https?:\/\//, "")}</span>
                                <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="truncate">{p.referrer}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.sessions)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.users)}</TableCell>
                        </TableRow>
                      );
                    })} />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
