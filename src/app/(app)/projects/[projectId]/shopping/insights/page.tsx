import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { SearchParamSelect } from "@/components/dashboard/search-param-select";
import { PagedTable } from "@/components/performance/table-pager";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { LOCATIONS, countryCode } from "@/lib/markets";
import { requireProject } from "@/lib/session";
import { loadInsights } from "@/lib/shopping";

export const metadata: Metadata = { title: "Insights" };

const money = (n: number, cur: string) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cur}`;
const words = (s: string | null) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ") : "—");
const STOCK: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  IN_STOCK: { label: "You sell it", variant: "secondary" },
  OUT_OF_STOCK: { label: "Out of stock", variant: "destructive" },
  NOT_IN_INVENTORY: { label: "Not sold", variant: "outline" },
};

function Note({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm">Couldn&apos;t load this report: {text.replace(/^Merchant Center: /, "")}</p>;
}

export default async function InsightsPage({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/insights">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const sp = await searchParams;
  const fallback = (countryCode(project.locationCode) ?? "us").toUpperCase();
  const country = typeof sp.country === "string" && LOCATIONS.some((l) => l.gl.toUpperCase() === sp.country) ? sp.country : fallback;

  const header = (
    <PageHeader
      title="Insights"
      actions={
        project.merchantId && !project.isDemo ? (
          <SearchParamSelect param="country" label="Country" value={country} items={LOCATIONS.map((l) => ({ value: l.gl.toUpperCase(), label: l.label }))} />
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
  const { data, problem } = await loadInsights(project, country);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Price competitiveness</CardTitle>
              <CardDescription>Your price next to the average price other stores show on Google for the same product.</CardDescription>
            </CardHeader>
            <CardContent>
              {"note" in data.prices ? (
                <Note text={data.prices.note} />
              ) : (
                <PagedTable
                  header={
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Your price</TableHead>
                      <TableHead className="text-right">Benchmark</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  }
                  empty={{ columns: 4, text: "Google has no benchmark prices for your products in this country yet." }}
                  rows={[...data.prices.rows]
                    .sort((a, b) => b.price / b.benchmark - a.price / a.benchmark)
                    .map((r) => {
                      const diff = (r.price / r.benchmark - 1) * 100;
                      return (
                        <TableRow key={r.offerId}>
                          <TableCell className="max-w-sm">
                            <span className="block truncate font-medium">{r.title}</span>
                            <span className="text-muted-foreground block text-xs">
                              {r.offerId}
                              {r.brand ? ` · ${r.brand}` : ""}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.price, r.currency)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(r.benchmark, r.currency)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={diff > 5 ? "destructive" : diff < -5 ? "secondary" : "outline"}>
                              {Math.abs(diff) < 0.5 ? "Same" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(0)}%`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best sellers</CardTitle>
              <CardDescription>
                The most popular products on Google in this country last week, by category, and whether you sell them.
                {"rows" in data.sellers && data.sellers.rows[0] ? ` Week of ${data.sellers.rows[0].date}.` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {"note" in data.sellers ? (
                <Note text={data.sellers.note} />
              ) : (
                <PagedTable
                  header={
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Demand</TableHead>
                      <TableHead>You</TableHead>
                    </TableRow>
                  }
                  empty={{ columns: 4, text: "No best-seller data for this country yet." }}
                  rows={data.sellers.rows.map((r, i) => {
                    const moved = r.previousRank != null ? r.previousRank - r.rank : null;
                    const stock = r.inventory ? STOCK[r.inventory] : null;
                    return (
                      <TableRow key={`${r.category}-${r.rank}-${i}`}>
                        <TableCell className="tabular-nums">
                          {r.rank}
                          {moved ? <span className={moved > 0 ? "text-xs text-emerald-600" : "text-destructive text-xs"}> {moved > 0 ? `↑${moved}` : `↓${-moved}`}</span> : null}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <span className="block truncate font-medium">{r.title}</span>
                          <span className="text-muted-foreground block text-xs">{[r.brand, r.category].filter(Boolean).join(" · ")}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {words(r.demand)}
                          {r.change === "RISER" ? " · rising" : r.change === "SINKER" ? " · falling" : ""}
                        </TableCell>
                        <TableCell>{stock ? <Badge variant={stock.variant}>{stock.label}</Badge> : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
