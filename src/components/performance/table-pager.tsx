"use client";

import { useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

export const PAGE_SIZE = 10; // see rule.md

/** Previous/next controls for a table showing PAGE_SIZE rows at a time. Renders nothing when everything fits on one page. */
export function TablePager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-sm tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm tabular-nums">
          Page {page + 1} of {pages}
        </span>
        <Button size="icon-sm" variant="outline" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

/** Rows for the current page of a client-side list. The page is clamped when the list shrinks. */
export function usePaged<T>(items: T[]) {
  const [requested, setPage] = useState(0);
  const page = Math.min(requested, Math.max(0, Math.ceil(items.length / PAGE_SIZE) - 1));
  return { page, setPage, shown: items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) };
}

/** A table whose rows (already rendered, each with a key) are paged. Works from server components. */
export function PagedTable({ header, rows, empty }: { header: ReactNode; rows: ReactNode[]; empty?: { columns: number; text: string } }) {
  const { page, setPage, shown } = usePaged(rows);
  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>{header}</TableHeader>
        <TableBody>
          {rows.length === 0 && empty ? (
            <TableRow>
              <TableCell colSpan={empty.columns} className="text-muted-foreground h-20 text-center">
                {empty.text}
              </TableCell>
            </TableRow>
          ) : (
            shown
          )}
        </TableBody>
      </Table>
      <TablePager page={page} total={rows.length} onPage={setPage} />
    </div>
  );
}

/** A list (a `<ul>` of `<li key>`, or a `<div>` of keyed items) whose items are paged. Works from server components. */
export function PagedList({ items, className, as: Tag = "ul" }: { items: ReactNode[]; className?: string; as?: "ul" | "div" }) {
  const { page, setPage, shown } = usePaged(items);
  return (
    <div className="flex flex-col gap-4">
      <Tag className={className}>{shown}</Tag>
      <TablePager page={page} total={items.length} onPage={setPage} />
    </div>
  );
}
