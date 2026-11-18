"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ISSUES, severityOf, type IssueCode, type Severity } from "@/lib/audit/issues";

export type AuditPageRow = {
  id: string;
  url: string;
  statusCode: number;
  title: string | null;
  wordCount: number;
  loadMs: number;
  issues: IssueCode[];
};

const FILTERS: { value: Severity | "all"; label: string }[] = [
  { value: "all", label: "All pages" },
  { value: "error", label: "Errors" },
  { value: "warning", label: "Warnings" },
  { value: "notice", label: "Notices" },
];

const BADGE: Record<Severity, "destructive" | "secondary" | "outline"> = { error: "destructive", warning: "secondary", notice: "outline" };
const ORDER: Record<Severity, number> = { error: 0, warning: 1, notice: 2 };

export function AuditPagesTable({ pages, origin }: { pages: AuditPageRow[]; origin: string }) {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages
      .filter((p) => (filter === "all" ? true : p.issues.some((c) => severityOf(c) === filter)))
      .filter((p) => !q || p.url.toLowerCase().includes(q) || (p.title ?? "").toLowerCase().includes(q))
      .map((p) => ({ ...p, issues: [...p.issues].sort((a, b) => ORDER[severityOf(a)] - ORDER[severityOf(b)]) }))
      .sort((a, b) => b.issues.filter((c) => severityOf(c) === "error").length - a.issues.filter((c) => severityOf(c) === "error").length || b.issues.length - a.issues.length);
  }, [pages, filter, query]);
  const { page, setPage, shown } = usePaged(rows);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Filter by severity">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => {
                setFilter(f.value);
                setPage(0);
              }}
              className="text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground hover:text-foreground rounded-md px-2.5 py-1 text-sm"
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input className="ml-auto h-8 w-full sm:w-64" placeholder="Search URL or title" value={query} onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Page</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="text-right">Words</TableHead>
            <TableHead className="text-right">Load</TableHead>
            <TableHead>Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                {pages.length === 0 ? "No pages were crawled." : "No pages match."}
              </TableCell>
            </TableRow>
          ) : (
            shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-80">
                  <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                    <span className="truncate">{p.url.replace(origin, "") || "/"}</span>
                    <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                  </a>
                  {p.title && <p className="text-muted-foreground truncate text-xs">{p.title}</p>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.statusCode || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{p.wordCount || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{p.loadMs ? `${p.loadMs} ms` : "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {p.issues.length === 0 ? (
                      <span className="text-muted-foreground text-xs">No issues</span>
                    ) : (
                      p.issues.map((c) => (
                        <Badge key={c} variant={BADGE[severityOf(c)]} title={ISSUES[c].hint}>
                          {ISSUES[c].label}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <TablePager page={page} total={rows.length} onPage={setPage} />
    </div>
  );
}
