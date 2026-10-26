import type { Metadata } from "next";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { RangePicker } from "@/components/dashboard/range-picker";
import { StatCard } from "@/components/dashboard/stat-card";
import { SyncButton } from "@/components/dashboard/sync-button";
import { AddKeywordsDialog } from "@/components/rankings/add-keywords-dialog";
import { RankingsTable } from "@/components/rankings/rankings-table";
import { parseRange } from "@/lib/dates";
import { formatNumber, formatPosition } from "@/lib/format";
import { locationLabel } from "@/lib/markets";
import { getRankingRows } from "@/lib/queries";
import { requireProject } from "@/lib/session";
import { averagePosition } from "@/lib/visibility";

export const metadata: Metadata = { title: "Rankings" };

export default async function RankingsPage({ params, searchParams }: PageProps<"/projects/[projectId]/rankings">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const days = parseRange((await searchParams).days);
  const rows = await getRankingRows(project.id, days);

  const avg = averagePosition(rows.map((r) => r.position));
  const improved = rows.filter((r) => (r.change ?? 0) > 0).length;
  const declined = rows.filter((r) => (r.change ?? 0) < 0).length;
  const top10 = rows.filter((r) => r.position != null && r.position <= 10).length;

  return (
    <>
      <PageHeader
        title="Rankings"
        description={`Google ${project.device.toLowerCase()} · ${locationLabel(project.locationCode)} · ${project.languageCode}`}
        actions={
          <>
            <RangePicker value={days} />
            <SyncButton projectId={project.id} parts={["rankings"]} label="Check now" />
            <AddKeywordsDialog projectId={project.id} />
          </>
        }
      />
      {project.isDemo && <DemoAlert />}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tracked" value={formatNumber(rows.length)} />
        <StatCard label="Avg. position" value={formatPosition(avg != null ? Number(avg.toFixed(1)) : null)} />
        <StatCard label="In top 10" value={formatNumber(top10)} />
        <StatCard label={`Moved in ${days}d`} value={`${improved} ↑ · ${declined} ↓`} />
      </div>
      <RankingsTable projectId={project.id} rows={rows} />
    </>
  );
}
