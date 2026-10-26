"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { addKeywords } from "@/lib/actions/projects";
import { formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { Delta } from "@/components/dashboard/delta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  gscPosition: number;
  tracked: { position: number | null; change: number | null } | null;
};

type View = "all" | "striking" | "tracked" | "untracked";

/** Position 4–20 with real impressions: a nudge away from page-one clicks. */
function isStriking(r: QueryRow) {
  return r.gscPosition >= 4 && r.gscPosition <= 20 && r.impressions >= 100;
}

export function QueriesTable({ projectId, rows }: { projectId: string; rows: QueryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && !r.query.toLowerCase().includes(needle)) return false;
      switch (view) {
        case "striking":
          return isStriking(r);
        case "tracked":
          return r.tracked != null;
        case "untracked":
          return r.tracked == null;
        default:
          return true;
      }
    });
  }, [rows, view, q]);

  function track(query: string) {
    startTransition(async () => {
      const res = await addKeywords({ projectId, phrases: query, tags: "from-gsc" });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Tracking “${query}”`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Filter queries" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        <ToggleGroup variant="outline" size="sm" value={[view]} onValueChange={(v) => v[0] && setView(v[0] as View)}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="striking">Striking distance</ToggleGroupItem>
          <ToggleGroupItem value="tracked">Tracked</ToggleGroupItem>
          <ToggleGroupItem value="untracked">Not tracked</ToggleGroupItem>
        </ToggleGroup>
        <span className="text-muted-foreground ml-auto text-sm">{visible.length} queries</span>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Query</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Impressions</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">GSC position</TableHead>
              <TableHead className="text-right">Tracked rank</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  {rows.length === 0 ? "No Search Console queries synced yet." : "No queries match."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.query}>
                  <TableCell className="max-w-72">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{r.query}</span>
                      {isStriking(r) && <Badge variant="secondary">Striking</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.impressions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(r.ctr)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPosition(Number(r.gscPosition.toFixed(1)))}</TableCell>
                  <TableCell className="text-right">
                    {r.tracked ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono tabular-nums">{r.tracked.position ?? "100+"}</span>
                        <Delta value={r.tracked.change} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.tracked && (
                      <Button size="xs" variant="ghost" disabled={pending} onClick={() => track(r.query)}>
                        <PlusIcon data-icon="inline-start" />
                        Track
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
