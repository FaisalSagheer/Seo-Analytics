"use client";

import { createContext, useContext, useTransition, type TransitionStartFunction } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type FilterTransition = { pending: boolean; startTransition: TransitionStartFunction };
const Ctx = createContext<FilterTransition | null>(null);

/**
 * The transition every page filter (country, date range, hourly/daily, listings…) runs in. Sharing it
 * lets the page show a skeleton while the new data loads. Outside the shell it falls back to a local one.
 */
export function useFilterTransition(): [boolean, TransitionStartFunction] {
  const shared = useContext(Ctx);
  const local = useTransition();
  return shared ? [shared.pending, shared.startTransition] : local;
}

/** KPI row, chart and table placeholders: the common page body. */
export function PageBodySkeleton() {
  return (
    <div data-skeleton className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}

/**
 * Wraps the page. While a filter's new data loads, everything after the page header (its first child)
 * is swapped for a skeleton, so old numbers never sit next to the new filter.
 */
export function FilterPendingArea({ children }: { children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <Ctx.Provider value={{ pending, startTransition }}>
      <div className="contents" data-filter-pending={pending || undefined}>
        {children}
        {pending && <PageBodySkeleton />}
      </div>
    </Ctx.Provider>
  );
}
