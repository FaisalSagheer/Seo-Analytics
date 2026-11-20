import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { SearchParamSelect } from "@/components/dashboard/search-param-select";
import { StatCard } from "@/components/dashboard/stat-card";
import { ProductHealthPanel } from "@/components/shopping/product-health";
import { STATUS_LABEL } from "@/lib/shopping-labels";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { compareWindow, resolveRange } from "@/lib/date-range";
import { formatNumber, formatPercent } from "@/lib/format";
import type { ProductHealthStatus } from "@/lib/providers/google";
import { requireProject } from "@/lib/session";
import { loadAccountIssues, loadProductHealth, loadShoppingPerformance, type MethodFilter } from "@/lib/shopping";
import { AccountIssues } from "@/components/shopping/account-issues";

export const metadata: Metadata = { title: "Shopping" };

const pct = (cur: number, before: number | undefined) => (before ? ((cur - before) / before) * 100 : undefined);

export default async function ShoppingPage({ params, searchParams }: PageProps<"/projects/[projectId]/shopping">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;
  const range = resolveRange(sp, 28);
  const method: MethodFilter = sp.method === "ORGANIC" || sp.method === "ADS" ? sp.method : "all";

  const header = (
    <PageHeader
      title="Shopping"
      actions={
        project.merchantId && !project.isDemo ? (
          <>
            <SearchParamSelect
              param="method"
              label="Listings"
              value={method}
              items={[
                { value: "all", label: "All listings" },
                { value: "ORGANIC", label: "Free listings" },
                { value: "ADS", label: "Shopping ads" },
              ]}
            />
            <RangePicker value={range.days} />
          </>
        ) : undefined
      }
    />
  );

  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }

  const [perf, health, issues] = await Promise.all([
    loadShoppingPerformance(project, { window: range, previous: compareWindow({ kind: "previous" }, range), method }),
    loadProductHealth(project),
    loadAccountIssues(project),
  ]);
  // Both calls usually fail for the same reason; say it once
  const problem = perf.problem ?? health.problem;
  const sameProblem = perf.problem && health.problem && perf.problem.kind === health.problem.kind;
  const t = perf.data?.totals;
  const prev = perf.data?.previous ?? undefined;

  return (
    <>
      {header}
      <AccountIssues issues={issues} projectId={project.id} />
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {health.problem && perf.problem && !sameProblem && <ProblemAlert problem={health.problem} projectId={project.id} />}

      {perf.data && t && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Clicks" value={formatNumber(t.clicks)} delta={pct(t.clicks, prev?.clicks)} deltaSuffix="%" hint={`vs previous ${range.days} days`} />
            <StatCard label="Impressions" value={formatNumber(t.impressions)} delta={pct(t.impressions, prev?.impressions)} deltaSuffix="%" hint={`vs previous ${range.days} days`} />
            <StatCard label="CTR" value={formatPercent(t.ctr)} />
            <StatCard label="Conversions" value={formatNumber(Math.round(t.conversions))} hint="Free listings only" />
          </div>

        </>
      )}

      {health.data && (
        <Card>
          <CardHeader>
            <CardTitle>Product health</CardTitle>
            <CardDescription>
              {formatNumber(health.data.total)} products
              {health.data.truncated ? " (the first 5,000 read)" : ""}:{" "}
              {(["APPROVED", "LIMITED", "PENDING", "DISAPPROVED"] as ProductHealthStatus[])
                .map((s) => `${formatNumber(health.data!.counts[s])} ${STATUS_LABEL[s].toLowerCase()}`)
                .join(", ")}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(["APPROVED", "LIMITED", "PENDING", "DISAPPROVED"] as ProductHealthStatus[]).map((s) => (
                <StatCard key={s} label={STATUS_LABEL[s]} value={formatNumber(health.data!.counts[s])} />
              ))}
            </div>
            <ProductHealthPanel health={health.data} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
