import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { PagedTable } from "@/components/performance/table-pager";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, parseRange, toDateKey, utcDay } from "@/lib/dates";
import { formatDate, formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { COMPETING_SHARE, rankChange } from "@/lib/queries";
import { requireProject } from "@/lib/session";
import { Delta } from "@/components/dashboard/delta";

export const metadata: Metadata = { title: "Keyword history" };

export default async function KeywordPage({ params, searchParams }: PageProps<"/projects/[projectId]/rankings/[keywordId]">) {
  const { projectId, keywordId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days, 90);
  const from = daysAgo(days - 1);

  const keyword = await db.keyword.findFirst({
    where: { id: keywordId, projectId: project.id },
    include: { snapshots: { where: { checkedAt: { gte: from } }, orderBy: { checkedAt: "asc" } } },
  });
  if (!keyword) notFound();
  const [gsc, pageDays] = await Promise.all([
    db.searchConsoleQuery.findFirst({ where: { projectId: project.id, query: keyword.phrase } }),
    db.rankPage.findMany({ where: { keywordId: keyword.id, date: { gte: from } } }),
  ]);

  // Every page that showed for this keyword in the range, most impressions first
  const pageMap = new Map<string, { page: string; impressions: number; clicks: number; weighted: number; days: Set<string>; last: Date }>();
  for (const r of pageDays) {
    const p = pageMap.get(r.page) ?? { page: r.page, impressions: 0, clicks: 0, weighted: 0, days: new Set<string>(), last: r.date };
    p.impressions += r.impressions;
    p.clicks += r.clicks;
    p.weighted += r.position * r.impressions;
    p.days.add(toDateKey(r.date));
    if (r.date > p.last) p.last = r.date;
    pageMap.set(r.page, p);
  }
  const currentUrl = keyword.snapshots.at(-1)?.url ?? null;
  const totalImpressions = [...pageMap.values()].reduce((sum, p) => sum + p.impressions, 0);
  const pages = [...pageMap.values()]
    .map((p) => ({ ...p, share: totalImpressions ? p.impressions / totalImpressions : 0, position: p.impressions ? p.weighted / p.impressions : null }))
    .sort((a, b) => b.impressions - a.impressions || a.page.localeCompare(b.page));
  const competing = pages.filter((p) => p.share >= COMPETING_SHARE).length;

  const byDate = new Map(keyword.snapshots.map((s) => [toDateKey(s.checkedAt), s]));
  const chart = dateKeys(from, utcDay()).map((date) => ({ date, position: byDate.get(date)?.position ?? null }));
  const ranked = keyword.snapshots.map((s) => s.position).filter((p): p is number => p != null);
  const first = keyword.snapshots[0]?.position ?? null;
  const last = keyword.snapshots.at(-1)?.position ?? null;
  // Newest first, only days where the position or URL changed, so the log reads as events
  const log = keyword.snapshots
    .filter((s, i, arr) => i === 0 || s.position !== arr[i - 1].position || s.url !== arr[i - 1].url)
    .reverse()
    .slice(0, 60);

  return (
    <>
      {/* Back link and header are one block: it stays visible while a filter loads */}
      <div className="flex flex-col gap-2">
        <Link href={`/projects/${project.id}/rankings`} className={buttonVariants({ variant: "ghost", size: "sm", className: "self-start" })}>
          <ArrowLeftIcon data-icon="inline-start" />
          Rankings
        </Link>
        <PageHeader title={keyword.phrase} actions={<RangePicker value={days} />} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Current" value={formatPosition(last)} delta={rankChange(first, last)} hint={`vs ${days} days ago`} />
        <StatCard label="Best" value={formatPosition(ranked.length ? Math.min(...ranked) : null)} />
        <StatCard label="Worst" value={formatPosition(ranked.length ? Math.max(...ranked) : null)} />
        <StatCard label="Search volume" value={formatNumber(keyword.searchVolume)} hint="Monthly" />
        <StatCard
          label="GSC clicks (28d)"
          value={formatNumber(gsc?.clicks ?? null)}
          hint={gsc ? `${formatNumber(gsc.impressions)} impr. · CTR ${formatPercent(gsc.ctr)}` : "No Search Console match"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Position history</CardTitle>
          <CardDescription>Daily Google position. Gaps mean the keyword was outside the top 100.</CardDescription>
        </CardHeader>
        <CardContent>
          <TrendChart
            data={chart}
            series={[{ key: "position", label: "Position", color: "var(--chart-1)" }]}
            format="position"
            reversed
            height={300}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pages ranking for this keyword</CardTitle>
          <CardDescription>
            {competing >= 2
              ? `${competing} of your pages split this keyword's impressions. Google may be unsure which page to show; consider making one the clear match.`
              : "Every page of the site that showed for this keyword in the range, from Search Console."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No page data yet. Run Check now on the Rankings page to fetch it.</p>
          ) : (
            <PagedTable header={<>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Avg. position</TableHead>
                  <TableHead className="text-right">Days shown</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </>} rows={pages.map((p) => (
                <TableRow key={p.page}>
                  <TableCell className="max-w-80">
                    <span className="flex items-center gap-2">
                      {/^https?:\/\//i.test(p.page) ? (
                        <a href={p.page} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-1 hover:underline">
                          <span className="truncate">{p.page.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                          <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="truncate">{p.page}</span>
                      )}
                      {p.page === currentUrl && <Badge variant="secondary">Current</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(p.share)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.position != null ? p.position.toFixed(1) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(p.days.size)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.last, "long")}</TableCell>
                </TableRow>
              ))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change log</CardTitle>
          <CardDescription>Days where the position or ranking URL changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <PagedTable header={<>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>URL</TableHead>
              </TableRow>
            </>} rows={log.map((s) => {
                const idx = keyword.snapshots.indexOf(s);
                const prev = idx > 0 ? keyword.snapshots[idx - 1].position : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.checkedAt, "long")}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{s.position ?? "100+"}</TableCell>
                    <TableCell>{idx > 0 ? <Delta value={rankChange(prev, s.position)} /> : "—"}</TableCell>
                    <TableCell className="text-muted-foreground max-w-80 truncate text-xs">{s.url ?? "—"}</TableCell>
                  </TableRow>
                );
              })} />
        </CardContent>
      </Card>
    </>
  );
}
