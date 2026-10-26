"use client";

import { useMemo, useState } from "react";
import { DownloadIcon, SearchIcon } from "lucide-react";
import { getBacklinkStatus, getLinkTypeLabel, getSourceLabel } from "@/lib/backlinks";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import type { BacklinkView } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Status = "all" | "live" | "new" | "lost";
type Follow = "all" | "dofollow" | "nofollow";

function exportCsv(domain: string, view: string, links: BacklinkView[]) {
  const csv = toCsv(
    ["Referring page", "Referring domain", "Domain rank", "Anchor", "Target page", "Link type", "Status", "First seen", "Last seen", "Source"],
    links.map((b) => [
      b.urlFrom,
      b.domainFrom,
      b.domainFromRank,
      b.anchor,
      b.urlTo,
      getLinkTypeLabel(b.dofollow),
      getBacklinkStatus(b).label,
      b.firstSeen,
      b.lastSeen,
      getSourceLabel(b.source),
    ]),
  );
  downloadCsv(`backlinks-${domain}-${view}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

export function BacklinksTable({ links, domain, view }: { links: BacklinkView[]; domain: string; view: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [follow, setFollow] = useState<Follow>("all");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return links.filter((b) => {
      if (needle && !`${b.domainFrom} ${b.anchor} ${b.urlTo}`.toLowerCase().includes(needle)) return false;
      // Unknown link types (Bing) match neither type filter
      if (follow === "dofollow" && b.dofollow !== true) return false;
      if (follow === "nofollow" && b.dofollow !== false) return false;
      if (status === "live") return !b.isLost;
      if (status === "new") return b.isNew && !b.isLost;
      if (status === "lost") return b.isLost;
      return true;
    });
  }, [links, q, status, follow]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Domain, anchor or target" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        <ToggleGroup variant="outline" size="sm" value={[status]} onValueChange={(v) => v[0] && setStatus(v[0] as Status)}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="live">Live</ToggleGroupItem>
          <ToggleGroupItem value="new">New</ToggleGroupItem>
          <ToggleGroupItem value="lost">Lost</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup variant="outline" size="sm" value={[follow]} onValueChange={(v) => v[0] && setFollow(v[0] as Follow)}>
          <ToggleGroupItem value="all">Any</ToggleGroupItem>
          <ToggleGroupItem value="dofollow">Dofollow</ToggleGroupItem>
          <ToggleGroupItem value="nofollow">Nofollow</ToggleGroupItem>
        </ToggleGroup>
        <span className="text-muted-foreground ml-auto text-sm">{visible.length} links</span>
        <Button variant="outline" size="sm" disabled={visible.length === 0} onClick={() => exportCsv(domain, view, visible)}>
          <DownloadIcon data-icon="inline-start" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referring page</TableHead>
              <TableHead className="text-right">DR</TableHead>
              <TableHead>Anchor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>First seen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                  {links.length === 0 ? "No backlinks loaded yet. Refresh to fetch them." : "No backlinks match."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((b) => {
                const s = getBacklinkStatus(b);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="max-w-72">
                      <div className="flex flex-col">
                        <span className="font-medium">{b.domainFrom}</span>
                        <a href={b.urlFrom} target="_blank" rel="noreferrer nofollow" className="text-muted-foreground truncate text-xs hover:underline">
                          {b.urlFrom.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{b.domainFromRank ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">{b.anchor || <span className="text-muted-foreground">(no anchor)</span>}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate text-xs">{b.urlTo.replace(/^https?:\/\/[^/]+/, "") || "/"}</TableCell>
                    <TableCell>
                      {b.dofollow == null ? (
                        <span className="text-muted-foreground text-xs">Unknown</span>
                      ) : (
                        <Badge variant={b.dofollow ? "secondary" : "outline"}>{getLinkTypeLabel(b.dofollow)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {b.firstSeen ? formatDate(b.firstSeen, "long") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
