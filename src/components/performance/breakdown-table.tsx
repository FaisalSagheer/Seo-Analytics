"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type BreakdownRow = { label: string; clicks: number; impressions: number; ctr: number; position: number };

/** A Search Console report table: one dimension, with clicks, impressions, CTR and position. */
export function BreakdownTable({ heading, rows, filterable = false, empty }: { heading: string; rows: BreakdownRow[]; filterable?: boolean; empty: string }) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? rows.filter((r) => r.label.toLowerCase().includes(needle)) : rows;
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-4">
      {filterable && (
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder={`Filter ${heading.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{heading}</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Position</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  {rows.length === 0 ? empty : "Nothing matches."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="max-w-96 truncate" title={r.label}>
                    {r.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.ctr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPosition(Number(r.position.toFixed(1)))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
