import { ExternalLinkIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { TopPageRow } from "@/lib/types";

export function TopPagesTable({ pages }: { pages: TopPageRow[] }) {
  const total = pages.reduce((s, p) => s + p.traffic, 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Page</TableHead>
          <TableHead className="text-right">Est. traffic</TableHead>
          <TableHead className="text-right">Share</TableHead>
          <TableHead className="text-right">Keywords</TableHead>
          <TableHead className="text-right">#1 rankings</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pages.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
              No pages yet. Refresh to load them.
            </TableCell>
          </TableRow>
        ) : (
          pages.map((p) => (
            <TableRow key={p.url}>
              <TableCell className="max-w-96">
                <a href={p.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                  <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                  <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                </a>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(Math.round(p.traffic))}</TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center justify-end gap-2">
                  <span className="bg-muted relative h-1.5 w-16 overflow-hidden rounded-full">
                    <span
                      className="bg-chart-1 absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${total ? (p.traffic / total) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-10 tabular-nums">{total ? `${((p.traffic / total) * 100).toFixed(0)}%` : "—"}</span>
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(p.keywords)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(p.pos1)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
