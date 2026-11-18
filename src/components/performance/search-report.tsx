"use client";

import type { ReactNode } from "react";
import { BreakdownTable, type BreakdownRow } from "@/components/performance/breakdown-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type SearchReportData = {
  pages: BreakdownRow[];
  countries: BreakdownRow[];
  devices: BreakdownRow[];
  appearance: BreakdownRow[];
};

/** Search Console's report tabs. The Queries tab is passed in because it has its own tracking actions. */
export function SearchReport({ queries, data, note }: { queries: ReactNode; data: SearchReportData | null; note?: string }) {
  const empty = note ?? "No data for this period.";
  return (
    <Tabs defaultValue="queries">
      <TabsList>
        <TabsTrigger value="queries">Queries</TabsTrigger>
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="countries">Countries</TabsTrigger>
        <TabsTrigger value="devices">Devices</TabsTrigger>
        <TabsTrigger value="appearance">Search appearance</TabsTrigger>
      </TabsList>
      <TabsContent value="queries" className="pt-4">
        {queries}
      </TabsContent>
      <TabsContent value="pages" className="pt-4">
        <BreakdownTable heading="Page" rows={data?.pages ?? []} filterable empty={empty} />
      </TabsContent>
      <TabsContent value="countries" className="pt-4">
        <BreakdownTable heading="Country" rows={data?.countries ?? []} empty={empty} />
      </TabsContent>
      <TabsContent value="devices" className="pt-4">
        <BreakdownTable heading="Device" rows={data?.devices ?? []} empty={empty} />
      </TabsContent>
      <TabsContent value="appearance" className="pt-4">
        <BreakdownTable heading="Search appearance" rows={data?.appearance ?? []} empty={empty} />
      </TabsContent>
    </Tabs>
  );
}
