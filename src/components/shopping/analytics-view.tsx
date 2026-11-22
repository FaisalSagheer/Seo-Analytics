import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { SearchParamSelect } from "@/components/dashboard/search-param-select";
import { StatCard } from "@/components/dashboard/stat-card";
import { PagedTable } from "@/components/performance/table-pager";
import {
  NoMerchant,
  ProblemAlert,
} from "@/components/shopping/merchant-states";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { compareWindow, resolveRange } from "@/lib/date-range";
import { formatNumber, formatPercent } from "@/lib/format";
import type { MarketingMethod } from "@/lib/providers/google";
import { requireProject } from "@/lib/session";
import { loadShoppingPerformance, type MethodFilter } from "@/lib/shopping";

const METHOD_LABEL: Record<MarketingMethod, string> = {
  ORGANIC: "Free listings",
  ADS: "Shopping ads",
  AFFILIATE: "Affiliate",
  OTHER: "Other",
};
const pct = (cur: number, before: number | undefined) =>
  before ? ((cur - before) / before) * 100 : undefined;

type View = "ads";
const TITLE: Record<View, string> = { ads: "Ad campaigns" };

/** Shopping ads results for Ad campaigns: totals, daily clicks and per-product numbers (Shopping ads only). */
export async function ShoppingAnalytics({
  projectId,
  sp,
  view,
  intro,
}: {
  projectId: string;
  sp: Record<string, string | string[] | undefined>;
  view: View;
  /** Shown above the numbers, e.g. the linked Google Ads accounts */
  intro?: React.ReactNode;
}) {
  const { project } = await requireProject(projectId);
  const range = resolveRange(sp, 28);
  // Ad campaigns always shows Shopping ads only
  const method: MethodFilter =
    view === "ads"
      ? "ADS"
      : sp.method === "ORGANIC" || sp.method === "ADS"
        ? sp.method
        : "all";

  const header = (
    <PageHeader
      title={TITLE[view]}
      actions={
        project.merchantId && !project.isDemo ? (
          <>
            {view !== "ads" && (
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
            )}
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

  const perf = await loadShoppingPerformance(project, {
    window: range,
    previous: compareWindow({ kind: "previous" }, range),
    method,
  });
  const problem = perf.problem;
  const t = perf.data?.totals;
  const prev = perf.data?.previous ?? undefined;

  return (
    <>
      {header}
      {intro}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}

      {perf.data && t && (
        <>
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Clicks"
                value={formatNumber(t.clicks)}
                delta={pct(t.clicks, prev?.clicks)}
                deltaSuffix="%"
                hint={`vs previous ${range.days} days`}
              />
              <StatCard
                label="Impressions"
                value={formatNumber(t.impressions)}
                delta={pct(t.impressions, prev?.impressions)}
                deltaSuffix="%"
                hint={`vs previous ${range.days} days`}
              />
              <StatCard label="CTR" value={formatPercent(t.ctr)} />
              <StatCard
                label="Conversions"
                value={formatNumber(Math.round(t.conversions))}
                hint="Free listings only"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Clicks per day</CardTitle>
                <CardDescription>
                  {perf.data.byMethod.length
                    ? perf.data.byMethod
                        .map(
                          (m) =>
                            `${METHOD_LABEL[m.method]}: ${formatNumber(m.clicks)} clicks, ${formatNumber(m.impressions)} impressions`,
                        )
                        .join(" · ")
                    : "No Shopping clicks in this range."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={perf.data.series}
                  series={[
                    {
                      key: "clicks",
                      label: "Clicks",
                      color: "var(--chart-1)",
                    },
                  ]}
                  height={220}
                />
              </CardContent>
            </Card>
          </>
          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>
                Clicks and impressions per product in the range, most clicked
                first.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PagedTable
                header={
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                  </TableRow>
                }
                empty={{
                  columns: 5,
                  text: "No product had impressions in this range.",
                }}
                rows={perf.data.products.map((p) => (
                  <TableRow key={p.offerId}>
                    <TableCell className="max-w-80">
                      <span className="block truncate font-medium">
                        {p.title}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {p.offerId}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(p.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(p.ctr)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(Math.round(p.conversions))}
                    </TableCell>
                  </TableRow>
                ))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
