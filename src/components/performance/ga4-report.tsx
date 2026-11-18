"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatPercent } from "@/lib/format";

export type Ga4Row = { label: string; sessions: number; users: number; engagementRate: number; conversions: number };
export type Ga4ReportData = { channels: Ga4Row[]; pages: Ga4Row[]; countries: Ga4Row[]; devices: Ga4Row[] };

function Ga4Table({ heading, rows, filterable = false, empty }: { heading: string; rows: Ga4Row[]; filterable?: boolean; empty: string }) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => r.label.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);
  const { page, setPage, shown } = usePaged(visible);

  return (
    <div className="flex flex-col gap-4">
      {filterable && (
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder={`Filter ${heading.toLowerCase()}`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </InputGroup>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{heading}</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Engagement rate</TableHead>
              <TableHead className="text-right">Conversions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  {rows.length === 0 ? empty : "Nothing matches."}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="max-w-96 truncate" title={r.label}>
                    {r.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.sessions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.users)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.engagementRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.conversions)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <TablePager page={page} total={visible.length} onPage={setPage} />
    </div>
  );
}

/** Google Analytics report tabs. Channels covers all traffic; the others are organic search only. */
export function Ga4Report({ data, note }: { data: Ga4ReportData | null; note?: string }) {
  const empty = note ?? "No data for this period.";
  return (
    <Tabs defaultValue="channels">
      <TabsList>
        <TabsTrigger value="channels">Channels</TabsTrigger>
        <TabsTrigger value="pages">Landing pages</TabsTrigger>
        <TabsTrigger value="countries">Countries</TabsTrigger>
        <TabsTrigger value="devices">Devices</TabsTrigger>
      </TabsList>
      <TabsContent value="channels" className="pt-4">
        <Ga4Table heading="Channel" rows={data?.channels ?? []} empty={empty} />
      </TabsContent>
      <TabsContent value="pages" className="pt-4">
        <Ga4Table heading="Landing page" rows={data?.pages ?? []} filterable empty={empty} />
      </TabsContent>
      <TabsContent value="countries" className="pt-4">
        <Ga4Table heading="Country" rows={data?.countries ?? []} empty={empty} />
      </TabsContent>
      <TabsContent value="devices" className="pt-4">
        <Ga4Table heading="Device" rows={data?.devices ?? []} empty={empty} />
      </TabsContent>
    </Tabs>
  );
}
