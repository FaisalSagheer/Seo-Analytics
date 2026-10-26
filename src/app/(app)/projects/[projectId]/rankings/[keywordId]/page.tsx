import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { TrendChart } from "@/components/charts/trend-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, parseRange, toDateKey, utcDay } from "@/lib/dates";
import { formatDate, formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { rankChange } from "@/lib/queries";
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
  const gsc = await db.searchConsoleQuery.findFirst({ where: { projectId: project.id, query: keyword.phrase } });

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
      <div>
        <Link href={`/projects/${project.id}/rankings`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeftIcon data-icon="inline-start" />
          Rankings
        </Link>
      </div>
      <PageHeader title={keyword.phrase} description={keyword.tags ? `Tags: ${keyword.tags}` : project.domain} actions={<RangePicker value={days} />} />

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
          <CardTitle>Change log</CardTitle>
          <CardDescription>Days where the position or ranking URL changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.map((s) => {
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
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
