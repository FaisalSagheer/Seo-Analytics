"use client";

import { ExternalLinkIcon, PencilIcon, SearchIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProductVideos } from "@/lib/actions/merchant";
import type { CatalogueRow } from "@/lib/shopping";
import { StatCard } from "@/components/dashboard/stat-card";
import { useCan } from "@/components/permissions-provider";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { Pick } from "@/components/shopping/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Filter = "all" | "with" | "without";

/** Product videos: which products have them, and adding or changing the links. */
export function VideoAssets({ projectId, rows }: { projectId: string; rows: CatalogueRow[] }) {
  const canEdit = useCan("merchant.manage");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ row: CatalogueRow; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const withVideo = rows.filter((r) => r.videos.length > 0).length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => filter === "all" || (filter === "with" ? r.videos.length > 0 : r.videos.length === 0))
      .filter((r) => !t || r.title.toLowerCase().includes(t) || r.offerId.toLowerCase().includes(t));
  }, [rows, q, filter]);
  const pages = usePaged(shown);

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveProductVideos(projectId, editing.row.name, editing.text.split("\n"));
      if (!res.ok) return void toast.error(res.error);
      toast.success("Videos saved. Google may take a few minutes to show them.");
      setEditing(null);
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Products" value={rows.length.toLocaleString()} />
        <StatCard label="With video" value={withVideo.toLocaleString()} />
        <StatCard label="Without video" value={(rows.length - withVideo).toLocaleString()} />
        <StatCard label="Videos" value={rows.reduce((n, r) => n + r.videos.length, 0).toLocaleString()} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product videos</CardTitle>
          <CardDescription>Videos shown with products on Google, from each product&apos;s video links. Changes made here override the feed&apos;s links for that product.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                aria-label="Search products"
                placeholder="Search title or ID"
                className="pl-8"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  pages.setPage(0);
                }}
              />
            </div>
            <Pick
              label="Filter by video"
              className="sm:w-56"
              value={filter}
              options={[
                { value: "all" as Filter, label: `All products (${rows.length})` },
                { value: "with" as Filter, label: `With video (${withVideo})` },
                { value: "without" as Filter, label: `Without video (${rows.length - withVideo})` },
              ]}
              onChange={(f) => {
                setFilter(f);
                pages.setPage(0);
              }}
            />
          </div>
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products match.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Videos</TableHead>
                    {canEdit && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.shown.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="max-w-xs">
                        <span className="block truncate font-medium">{r.title}</span>
                        <span className="text-muted-foreground block text-xs">{r.offerId}</span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {r.videos.length === 0 ? (
                          <span className="text-muted-foreground text-sm">None</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {r.videos.map((v) => (
                              <li key={v}>
                                <a href={v} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-sm hover:underline">
                                  <span className="truncate">{v.replace(/^https?:\/\//, "")}</span>
                                  <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit videos for ${r.title}`} onClick={() => setEditing({ row: r, text: r.videos.join("\n") })}>
                            <PencilIcon />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager page={pages.page} total={shown.length} onPage={pages.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Videos for {editing.row.title}</DialogTitle>
                <DialogDescription>One link per line, up to 10 (YouTube or a video file on your site). Leave it empty to go back to the feed&apos;s videos.</DialogDescription>
              </DialogHeader>
              <Textarea aria-label="Video links" rows={6} placeholder="https://www.youtube.com/watch?v=…" value={editing.text} disabled={pending} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Save videos
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
