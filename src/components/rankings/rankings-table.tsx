"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUpIcon, ExternalLinkIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteKeywords } from "@/lib/actions/projects";
import { formatNumber, formatPosition } from "@/lib/format";
import type { RankingRow } from "@/lib/types";
import { Sparkline } from "@/components/charts/sparkline";
import { Delta } from "@/components/dashboard/delta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCan } from "@/components/permissions-provider";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Bucket = "all" | "top3" | "top10" | "11-20" | "21-50" | "51-100" | "unranked";
type Movement = "all" | "up" | "down" | "flat";
type SortKey = "phrase" | "position" | "change" | "searchVolume" | "best";

const BUCKETS: { value: Bucket; label: string }[] = [
  { value: "all", label: "All positions" },
  { value: "top3", label: "Top 3" },
  { value: "top10", label: "Top 10" },
  { value: "11-20", label: "11–20" },
  { value: "21-50", label: "21–50" },
  { value: "51-100", label: "51–100" },
  { value: "unranked", label: "Not ranking" },
];
const MOVEMENTS: { value: Movement; label: string }[] = [
  { value: "all", label: "Any movement" },
  { value: "up", label: "Improved" },
  { value: "down", label: "Declined" },
  { value: "flat", label: "Unchanged" },
];

function inBucket(p: number | null, b: Bucket) {
  switch (b) {
    case "top3":
      return p != null && p <= 3;
    case "top10":
      return p != null && p <= 10;
    case "11-20":
      return p != null && p > 10 && p <= 20;
    case "21-50":
      return p != null && p > 20 && p <= 50;
    case "51-100":
      return p != null && p > 50;
    case "unranked":
      return p == null;
    default:
      return true;
  }
}

function matchesMovement(c: number | null, m: Movement) {
  switch (m) {
    case "up":
      return c != null && c > 0;
    case "down":
      return c != null && c < 0;
    case "flat":
      return c === 0 || c == null;
    default:
      return true;
  }
}

/** Sort value; unranked positions sink to the bottom when sorting by rank. */
function sortValue(r: RankingRow, key: SortKey): number | string {
  switch (key) {
    case "phrase":
      return r.phrase;
    case "position":
      return r.position ?? 999;
    case "best":
      return r.best ?? 999;
    case "change":
      return r.change ?? 0;
    case "searchVolume":
      return r.searchVolume ?? -1;
    default:
      return 0;
  }
}

export function RankingsTable({ projectId, rows }: { projectId: string; rows: RankingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [movement, setMovement] = useState<Movement>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "position", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canEdit = useCan("keywords.manage");

  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  const tagItems = [{ value: "all", label: "All tags" }, ...tags.map((t) => ({ value: t, label: t }))];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (!q || r.phrase.includes(q)) &&
          (tag === "all" || r.tags.includes(tag)) &&
          inBucket(r.position, bucket) &&
          matchesMovement(r.change, movement),
      )
      .sort((a, b) => {
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        return (typeof av === "string" ? av.localeCompare(bv as string) : av - (bv as number)) * sort.dir;
      });
  }, [rows, query, tag, bucket, movement, sort]);

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.keywordId));

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "change" || key === "searchVolume" ? -1 : 1 }));
  }

  function removeSelected() {
    const keywordIds = [...selected];
    startTransition(async () => {
      const res = await deleteKeywords({ projectId, keywordIds });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Removed ${res.data.deleted} keyword${res.data.deleted === 1 ? "" : "s"}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  const sortProps = { active: sort.key, onSort: toggleSort };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Filter keywords" value={query} onChange={(e) => setQuery(e.target.value)} />
        </InputGroup>
        <FilterSelect items={tagItems} value={tag} onChange={setTag} label="Tag" />
        <FilterSelect items={BUCKETS} value={bucket} onChange={(v) => setBucket(v as Bucket)} label="Position" />
        <FilterSelect items={MOVEMENTS} value={movement} onChange={(v) => setMovement(v as Movement)} label="Movement" />
        <span className="text-muted-foreground ml-auto text-sm">
          {visible.length} of {rows.length}
        </span>
        {canEdit && selected.size > 0 && (
          <Button variant="destructive" size="sm" disabled={pending} onClick={removeSelected}>
            <Trash2Icon data-icon="inline-start" />
            Remove {selected.size}
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-8">
                  <Checkbox
                    aria-label="Select all"
                    checked={allSelected}
                    onCheckedChange={(c) => setSelected(c ? new Set(visible.map((r) => r.keywordId)) : new Set())}
                  />
                </TableHead>
              )}
              <SortHead k="phrase" {...sortProps}>Keyword</SortHead>
              <SortHead k="position" className="text-right" {...sortProps}>Position</SortHead>
              <SortHead k="change" {...sortProps}>Change</SortHead>
              <TableHead>Trend</TableHead>
              <SortHead k="best" {...sortProps}>Best</SortHead>
              <SortHead k="searchVolume" {...sortProps}>Volume</SortHead>
              <TableHead>Ranking URL</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 8 : 7} className="text-muted-foreground h-24 text-center">
                  {rows.length === 0 ? "No keywords tracked yet. Add some to start the history." : "No keywords match these filters."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.keywordId} data-state={selected.has(r.keywordId) ? "selected" : undefined}>
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${r.phrase}`}
                        checked={selected.has(r.keywordId)}
                        onCheckedChange={(c) => {
                          const next = new Set(selected);
                          if (c) next.add(r.keywordId);
                          else next.delete(r.keywordId);
                          setSelected(next);
                        }}
                      />
                    </TableCell>
                  )}
                  <TableCell className="max-w-72">
                    <div className="flex flex-col gap-1">
                      <Link href={`/projects/${projectId}/rankings/${r.keywordId}`} className="truncate font-medium hover:underline">
                        {r.phrase}
                      </Link>
                      {r.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.tags.map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-base font-semibold tabular-nums">
                    {r.position ?? <span className="text-muted-foreground text-sm font-normal">100+</span>}
                  </TableCell>
                  <TableCell>
                    <Delta value={r.change} />
                  </TableCell>
                  <TableCell>
                    <Sparkline points={r.history.map((h) => h.position)} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatPosition(r.best)}</TableCell>
                  <TableCell className="tabular-nums">{formatNumber(r.searchVolume)}</TableCell>
                  <TableCell className="max-w-56">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                      >
                        <span className="truncate">{r.url.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                        <ExternalLinkIcon className="size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
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

function SortHead({
  k,
  active,
  onSort,
  children,
  className,
}: {
  k: SortKey;
  active: SortKey;
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <Button variant="ghost" size="sm" className="-ml-2 h-7" onClick={() => onSort(k)}>
        {children}
        <ArrowDownUpIcon data-icon="inline-end" className={active === k ? "opacity-100" : "opacity-40"} />
      </Button>
    </TableHead>
  );
}

function FilterSelect({
  items,
  value,
  onChange,
  label,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger size="sm" aria-label={label} className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
