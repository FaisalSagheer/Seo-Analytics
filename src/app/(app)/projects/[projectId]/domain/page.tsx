import type { Metadata } from "next";
import { DistributionBars } from "@/components/charts/distribution-bars";
import { TrendChart } from "@/components/charts/trend-chart";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { DomainLookup } from "@/components/domain/domain-lookup";
import { TopPagesTable } from "@/components/domain/top-pages-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseRange, toDateKey } from "@/lib/dates";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getDomainData } from "@/lib/queries";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Domain overview" };

function pctChange(now: number | undefined, then: number | undefined) {
  if (now == null || then == null || then === 0) return null;
  return ((now - then) / then) * 100;
}

export default async function DomainPage({ params, searchParams }: PageProps<"/projects/[projectId]/domain">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days, 180);
  const { snapshots, pages } = await getDomainData(project.id, days);

  // Snapshots taken with only a backlink source (Bing) carry no organic data
  const organic = snapshots.flatMap((s) =>
    s.organicKeywords != null && s.organicTraffic != null
      ? [{ ...s, organicKeywords: s.organicKeywords, organicTraffic: s.organicTraffic, pos1: s.pos1 ?? 0, pos2to3: s.pos2to3 ?? 0, pos4to10: s.pos4to10 ?? 0 }]
      : [],
  );
  const latest = organic.at(-1);
  const first = organic[0];
  const history = organic.map((s) => ({
    date: toDateKey(s.capturedAt),
    organicKeywords: s.organicKeywords,
    organicTraffic: Math.round(s.organicTraffic),
  }));
  const distribution = latest
    ? [
        { band: "#1", count: latest.pos1 },
        { band: "#2–3", count: latest.pos2to3 },
        { band: "#4–10", count: latest.pos4to10 },
        { band: "#11–100", count: Math.max(0, latest.organicKeywords - latest.pos1 - latest.pos2to3 - latest.pos4to10) },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Domain overview"
        description={`Organic footprint of ${project.domain}, estimated from Google results.`}
        actions={
          <>
            <RangePicker value={days} />
            <SyncButton projectId={project.id} parts={["domain"]} />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Organic keywords"
          value={formatNumber(latest?.organicKeywords)}
          delta={pctChange(latest?.organicKeywords, first?.organicKeywords)}
          deltaSuffix="%"
          deltaDigits={1}
        />
        <StatCard
          label="Est. organic traffic"
          value={formatNumber(latest ? Math.round(latest.organicTraffic) : null)}
          delta={pctChange(latest?.organicTraffic, first?.organicTraffic)}
          deltaSuffix="%"
          deltaDigits={1}
          hint="Monthly visits"
        />
        <StatCard label="Traffic value" value={formatCurrency(latest?.trafficCost, { compact: true })} hint="Equivalent monthly ad spend" />
        <StatCard
          label="Top 10 share"
          value={formatPercent(latest ? (latest.pos1 + latest.pos2to3 + latest.pos4to10) / Math.max(1, latest.organicKeywords) : null)}
          hint="Keywords on page one"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Organic visibility over time</CardTitle>
            <CardDescription>Estimated monthly organic traffic at each snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TrendChart
              syncId="domain"
              data={history}
              series={[{ key: "organicTraffic", label: "Est. traffic", color: "var(--chart-1)" }]}
              height={200}
              emptyMessage="Refresh to capture the first snapshot."
            />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Ranking keywords</h3>
              <TrendChart
                syncId="domain"
                data={history}
                series={[{ key: "organicKeywords", label: "Keywords", color: "var(--chart-3)" }]}
                height={160}
                emptyMessage="Refresh to capture the first snapshot."
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Position distribution</CardTitle>
            <CardDescription>Keywords by ranking band, latest snapshot.</CardDescription>
          </CardHeader>
          <CardContent>
            {latest ? <DistributionBars data={distribution} /> : <p className="text-muted-foreground text-sm">No snapshot yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top pages</CardTitle>
          <CardDescription>Pages earning the most estimated organic traffic.</CardDescription>
        </CardHeader>
        <CardContent>
          <TopPagesTable pages={pages} />
        </CardContent>
      </Card>

      <DomainLookup projectId={project.id} />
    </>
  );
}
