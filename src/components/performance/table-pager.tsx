"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZE = 12;

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
