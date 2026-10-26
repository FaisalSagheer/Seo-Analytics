import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { BacklinksTable } from "@/components/backlinks/backlinks-table";
import { BACKLINK_VIEWS, getSourceLabel, getViewLabel, parseBacklinkView } from "@/lib/backlinks";
import { SearchParamToggle } from "@/components/dashboard/search-param-toggle";
import { TopAnchors } from "@/components/backlinks/top-anchors";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseRange } from "@/lib/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { getBacklinkReport } from "@/lib/queries";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Backlinks" };

export default async function BacklinksPage({ params, searchParams }: PageProps<"/projects/[projectId]/backlinks">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;
  const days = parseRange(sp.days, 180);
  const report = (await getBacklinkReport(project.id, days, parseBacklinkView(sp.source)))!;
  const { summary } = report;
  const bingOnly = report.view === "bing";
  const sourceOptions = BACKLINK_VIEWS.map((v) => ({
    value: v,
    label: getViewLabel(v),
    disabled: !report.availableViews.includes(v),
  }));

  return (
    <>
      <PageHeader
        title="Backlinks"
        description={
          report.sources.length
            ? `Links pointing to ${project.domain}. Source: ${report.sources.map(getSourceLabel).join(", ")}.`
            : `Links pointing to ${project.domain}.`
        }
        actions={
          <>
            <SearchParamToggle param="source" value={report.view} options={sourceOptions} label="Backlink source" />
            <RangePicker value={days} />
            <SyncButton projectId={project.id} parts={["domain"]} />
            {/* A real link (new tab), styled as a button; Button would add role="button" */}
            <Link
              href={`/report/${project.id}/backlinks?days=${days}&source=${report.view}`}
              target="_blank"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <FileTextIcon data-icon="inline-start" />
              PDF report
            </Link>
          </>
        }
      />
      {project.isDemo && <DemoAlert />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Referring domains" value={formatNumber(summary.referringDomains)} delta={summary.referringDomainsChange ?? undefined} />
        <StatCard label="Backlinks" value={formatNumber(summary.backlinks)} />
        <StatCard label="Domain rank" value={summary.domainRank != null ? String(summary.domainRank) : "—"} hint={bingOnly ? "Not reported by Bing" : "0–100"} />
        <StatCard
          label="Dofollow (sample)"
          value={formatPercent(summary.dofollowShare)}
          hint={bingOnly ? "Not reported by Bing" : `Of ${summary.sampleSize} strongest links`}
        />
        <StatCard label="New / lost (sample)" value={bingOnly ? "—" : `${summary.newCount} / ${summary.lostCount}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Referring domains over time</CardTitle>
            <CardDescription>
              Unique domains linking to you at each snapshot.{bingOnly && " With Bing, this counts domains in the fetched sample."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={report.history}
              series={[{ key: "referringDomains", label: "Referring domains", color: "var(--chart-1)" }]}
              height={240}
              emptyMessage="Refresh to capture the first snapshot."
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top anchors</CardTitle>
            <CardDescription>Most common anchor text in the sample.</CardDescription>
          </CardHeader>
          <CardContent>
            <TopAnchors anchors={report.anchors.slice(0, 8)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backlinks</CardTitle>
          <CardDescription>
            {bingOnly ? "Up to 500 links from Bing Webmaster Tools, across your most-linked pages." : "The strongest links by referring-domain rank."}{" "}
            Export CSV downloads the rows matching your filters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BacklinksTable key={report.view} links={report.links} domain={project.domain} view={report.view} />
        </CardContent>
      </Card>
    </>
  );
}
