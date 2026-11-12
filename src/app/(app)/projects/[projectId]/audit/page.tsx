import type { Metadata } from "next";
import { ScanSearchIcon } from "lucide-react";
import { AuditButton } from "@/components/audit/audit-button";
import { AuditPagesTable, type AuditPageRow } from "@/components/audit/audit-pages-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { db } from "@/lib/db";
import { ISSUES, isIssueCode, severityOf, type IssueCode, type Severity } from "@/lib/audit/issues";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Site audit" };
// Crawls run inside the server action invoked from this page; allow it time on hosts that cap functions
export const maxDuration = 120;

const asCodes = (value: unknown): IssueCode[] => (Array.isArray(value) ? value.filter(isIssueCode) : []);
const BADGE: Record<Severity, "destructive" | "secondary" | "outline"> = { error: "destructive", warning: "secondary", notice: "outline" };

export default async function AuditPage({ params }: PageProps<"/projects/[projectId]/audit">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const [run, lastFailed] = await Promise.all([
    db.auditRun.findFirst({ where: { projectId, status: "DONE" }, orderBy: { startedAt: "desc" }, include: { pages: true } }),
    db.auditRun.findFirst({ where: { projectId, status: "FAILED" }, orderBy: { startedAt: "desc" } }),
  ]);
  const showFailure = lastFailed && (!run || lastFailed.startedAt > run.startedAt);

  const header = (
    <PageHeader
      title="Site audit"
      description={`Crawls up to 50 pages of ${project.domain} and checks titles, meta tags, headings, links, speed and indexability.`}
      actions={<AuditButton projectId={project.id} label={run ? "Re-run audit" : "Run audit"} />}
    />
  );

  if (!run) {
    return (
      <>
        {header}
        {showFailure && (
          <Alert variant="destructive">
            <AlertTitle>The last audit failed</AlertTitle>
            <AlertDescription>{lastFailed.error ?? "Unknown error"}</AlertDescription>
          </Alert>
        )}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ScanSearchIcon />
            </EmptyMedia>
            <EmptyTitle>No audit yet</EmptyTitle>
            <EmptyDescription>Run an audit to crawl {project.domain} and list what to fix. No API keys needed.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </>
    );
  }

  const pages: AuditPageRow[] = run.pages.map((p) => ({
    id: p.id,
    url: p.url,
    statusCode: p.statusCode,
    title: p.title,
    wordCount: p.wordCount,
    loadMs: p.loadMs,
    issues: asCodes(p.issues),
  }));
  const siteIssues = asCodes(run.siteIssues);

  // Count affected pages per issue, most severe first
  const counts = new Map<IssueCode, number>();
  for (const p of pages) for (const c of p.issues) counts.set(c, (counts.get(c) ?? 0) + 1);
  const order: Record<Severity, number> = { error: 0, warning: 1, notice: 2 };
  const summary = [...counts].sort((a, b) => order[severityOf(a[0])] - order[severityOf(b[0])] || b[1] - a[1]);
  const pagesWith = (s: Severity) => pages.filter((p) => p.issues.some((c) => severityOf(c) === s)).length;
  const origin = new URL(run.startUrl).origin;

  return (
    <>
      {header}
      {showFailure && (
        <Alert variant="destructive">
          <AlertTitle>The last audit failed</AlertTitle>
          <AlertDescription>{lastFailed.error ?? "Unknown error"}. Showing the previous successful audit.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Health score" value={run.score != null ? String(run.score) : "—"} hint="0–100" />
        <StatCard label="Pages crawled" value={String(run.pagesCrawled)} hint={run.finishedAt ? `Finished ${run.finishedAt.toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}` : undefined} />
        <StatCard label="Pages with errors" value={String(pagesWith("error"))} />
        <StatCard label="Pages with warnings" value={String(pagesWith("warning"))} />
        <StatCard label="Pages with notices" value={String(pagesWith("notice"))} />
      </div>

      {siteIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Site-wide findings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {siteIssues.map((c) => (
              <div key={c} className="flex items-start gap-3">
                <Badge variant={BADGE[severityOf(c)]}>{ISSUES[c].label}</Badge>
                <p className="text-muted-foreground text-sm">{ISSUES[c].hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What to fix</CardTitle>
          <CardDescription>Issues found across crawled pages, most severe first.</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.length === 0 ? (
            <p className="text-muted-foreground text-sm">No page issues found.</p>
          ) : (
            <ul className="divide-y">
              {summary.map(([code, n]) => (
                <li key={code} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <Badge variant={BADGE[severityOf(code)]} className="mt-0.5 capitalize">
                    {severityOf(code)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ISSUES[code].label}</p>
                    <p className="text-muted-foreground text-sm">{ISSUES[code].hint}</p>
                  </div>
                  <span className="text-sm tabular-nums">
                    {n} page{n === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crawled pages</CardTitle>
          <CardDescription>Hover an issue for how to fix it.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditPagesTable pages={pages} origin={origin} />
        </CardContent>
      </Card>
    </>
  );
}
