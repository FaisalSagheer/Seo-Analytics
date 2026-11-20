"use client";

import { PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addScheduledFeed, fetchFeedNow, removeFeed, setFeedSchedule, type NewFeed } from "@/lib/actions/merchant";
import type { DataSourceDoc } from "@/lib/providers/google";
import type { FeedRow } from "@/lib/shopping";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { CsvInput, F, NumInput, Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const kindOf = (d: DataSourceDoc) =>
  d.primaryProductDataSource
    ? "Products (primary)"
    : d.supplementalProductDataSource
      ? "Products (supplemental)"
      : d.promotionDataSource
        ? "Promotions"
        : d.localInventoryDataSource
          ? "Local inventory"
          : d.regionalInventoryDataSource
            ? "Regional inventory"
            : d.productReviewDataSource
              ? "Product reviews"
              : d.merchantReviewDataSource
                ? "Store reviews"
                : "Other";

const inputOf = (d: DataSourceDoc) => {
  if (d.input === "API") return "API";
  if (d.input === "UI") return "Merchant Center";
  if (d.input === "AUTOFEED") return "Autofeed (from the website)";
  const t = d.fileInput?.fileInputType;
  return t === "FETCH" ? "Scheduled URL fetch" : t === "GOOGLE_SHEETS" ? "Google Sheets" : t === "UPLOAD" ? "File upload" : "File";
};

const FREQ: Record<string, string> = { FREQUENCY_DAILY: "Daily", FREQUENCY_WEEKLY: "Weekly", FREQUENCY_MONTHLY: "Monthly" };
const schedule = (d: DataSourceDoc) => {
  const f = d.fileInput?.fetchSettings;
  if (!f?.frequency) return null;
  const when = f.frequency === "FREQUENCY_WEEKLY" && f.dayOfWeek ? ` on ${f.dayOfWeek.charAt(0) + f.dayOfWeek.slice(1).toLowerCase()}` : f.frequency === "FREQUENCY_MONTHLY" && f.dayOfMonth ? ` on day ${f.dayOfMonth}` : "";
  return `${FREQ[f.frequency] ?? f.frequency}${when} at ${String(f.timeOfDay?.hours ?? 0).padStart(2, "0")}:00${f.timeZone ? ` ${f.timeZone}` : " UTC"}`;
};

const UPLOAD: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  SUCCEEDED: { label: "Processed", variant: "secondary" },
  IN_PROGRESS: { label: "Processing", variant: "outline" },
  FAILED: { label: "Failed", variant: "destructive" },
};

function UploadSummary({ row }: { row: FeedRow }) {
  const u = row.upload;
  if (row.input !== "FILE") return <span className="text-muted-foreground">—</span>;
  if (!u) return <span className="text-muted-foreground">No upload yet</span>;
  const st = UPLOAD[u.processingState ?? ""] ?? { label: "Unknown", variant: "outline" as const };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={st.variant}>{st.label}</Badge>
        {u.uploadTime && <span className="text-muted-foreground text-xs">{new Date(u.uploadTime).toLocaleString()}</span>}
      </div>
      {u.itemsTotal && (
        <span className="text-muted-foreground text-xs">
          {Number(u.itemsTotal).toLocaleString()} items · {Number(u.itemsCreated ?? 0).toLocaleString()} new · {Number(u.itemsUpdated ?? 0).toLocaleString()} updated
        </span>
      )}
      {(u.issues ?? []).slice(0, 3).map((i, k) => (
        <span key={k} className={i.severity === "ERROR" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
          {i.title}
          {i.count ? ` (${Number(i.count).toLocaleString()})` : ""}
        </span>
      ))}
      {(u.issues ?? []).length > 3 && <span className="text-muted-foreground text-xs">and {u.issues!.length - 3} more issues</span>}
    </div>
  );
}

/** Data sources: where products, promotions and inventory come from, with each file feed's last upload. */
export function Feeds({ projectId, feeds }: { projectId: string; feeds: FeedRow[] }) {
  const canEdit = useCan("merchant.manage");
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const pages = usePaged(feeds);

  const write = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data sources</CardTitle>
        <CardDescription>Where Merchant Center gets products, promotions and inventory. Files and Sheets are edited at their source.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {feeds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data sources yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data source</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Last upload</TableHead>
                  {canEdit && <TableHead className="w-48" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.shown.map((d) => {
                  const fetchable = d.fileInput?.fileInputType === "FETCH";
                  const paused = d.fileInput?.fetchSettings?.enabled === false;
                  const p = d.primaryProductDataSource;
                  return (
                    <TableRow key={d.name}>
                      <TableCell className="max-w-xs align-top">
                        <span className="block font-medium">{d.displayName || d.dataSourceId}</span>
                        <span className="text-muted-foreground block text-xs">
                          {kindOf(d)}
                          {p?.feedLabel ? ` · ${p.contentLanguage}/${p.feedLabel}` : ""}
                          {p?.countries?.length ? ` · ${p.countries.join(", ")}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="block">{inputOf(d)}</span>
                        {schedule(d) && (
                          <span className="text-muted-foreground block text-xs">
                            {schedule(d)}
                            {paused && " · paused"}
                          </span>
                        )}
                        {d.fileInput?.fetchSettings?.fetchUri && <span className="text-muted-foreground block max-w-56 truncate text-xs">{d.fileInput.fetchSettings.fetchUri}</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        <UploadSummary row={d} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right align-top">
                          <div className="flex flex-wrap justify-end gap-1">
                            {fetchable && !paused && (
                              <Button size="sm" variant="outline" disabled={pending} onClick={() => write(() => fetchFeedNow(projectId, d.name!), "Fetch started. The upload status updates when Google finishes.")}>
                                <RefreshCwIcon data-icon="inline-start" />
                                Fetch now
                              </Button>
                            )}
                            {fetchable && (
                              <Button size="sm" variant="ghost" disabled={pending} onClick={() => write(() => setFeedSchedule(projectId, d.name!, paused), paused ? "Schedule resumed." : "Schedule paused.")}>
                                {paused ? "Resume" : "Pause"}
                              </Button>
                            )}
                            <ConfirmDelete
                              triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.displayName || d.dataSourceId}`} disabled={pending} />}
                              title={`Delete "${d.displayName || d.dataSourceId}"?`}
                              description={
                                d.primaryProductDataSource
                                  ? "Every product from this data source is removed from Merchant Center and stops showing on Google."
                                  : d.supplementalProductDataSource
                                    ? "The values it adds or overrides are removed from the products it's linked to."
                                    : "It and everything it provides are removed from Merchant Center."
                              }
                              details={[
                                { label: "Type", value: kindOf(d) },
                                { label: "Input", value: inputOf(d) },
                                ...(d.upload?.itemsTotal ? [{ label: "Items in last upload", value: Number(d.upload.itemsTotal).toLocaleString() }] : []),
                              ]}
                              onConfirm={() => write(() => removeFeed(projectId, d.name!), "Data source deleted.")}
                            >
                              <Trash2Icon />
                            </ConfirmDelete>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePager page={pages.page} total={feeds.length} onPage={pages.setPage} />
          </>
        )}
        {canEdit && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            Add scheduled feed
          </Button>
        )}
      </CardContent>
      {adding && <AddFeedDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function AddFeedDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [f, setF] = useState<NewFeed>({
    displayName: "",
    fetchUri: "",
    fileName: "",
    contentLanguage: "en",
    feedLabel: "",
    countries: [],
    frequency: "FREQUENCY_DAILY",
    hour: 3,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    dayOfWeek: "MONDAY",
    dayOfMonth: 1,
    username: "",
    password: "",
  });
  const set = (p: Partial<NewFeed>) => setF({ ...f, ...p });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await addScheduledFeed(projectId, f);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Feed added. Google fetches it on schedule; use Fetch now to start right away.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add scheduled feed</DialogTitle>
          <DialogDescription>A product file (XML, CSV or TSV) that Google downloads from a URL on a schedule.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
          <F label="Name" className="sm:col-span-2">
            <Input aria-label="Feed name" value={f.displayName} onChange={(e) => set({ displayName: e.target.value })} />
          </F>
          <F label="File URL" className="sm:col-span-2">
            <Input aria-label="File URL" placeholder="https://example.com/products.xml" value={f.fetchUri} onChange={(e) => set({ fetchUri: e.target.value })} />
          </F>
          <F label="File name (optional)">
            <Input aria-label="File name" placeholder="products.xml" value={f.fileName} onChange={(e) => set({ fileName: e.target.value })} />
          </F>
          <F label="Language (2 letters)">
            <Input aria-label="Feed language" maxLength={2} value={f.contentLanguage} onChange={(e) => set({ contentLanguage: e.target.value.toLowerCase().replace(/[^a-z]/g, "") })} />
          </F>
          <F label="Feed label (usually the country)">
            <Input aria-label="Feed label" placeholder="e.g. PK" maxLength={20} value={f.feedLabel} onChange={(e) => set({ feedLabel: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} />
          </F>
          <F label="Countries shown in (optional)">
            <CsvInput upper label="Feed countries" placeholder="e.g. PK, AE" value={f.countries} onChange={(countries) => set({ countries })} />
          </F>
          <F label="How often">
            <Pick
              label="Fetch frequency"
              value={f.frequency}
              options={[
                { value: "FREQUENCY_DAILY" as const, label: "Daily" },
                { value: "FREQUENCY_WEEKLY" as const, label: "Weekly" },
                { value: "FREQUENCY_MONTHLY" as const, label: "Monthly" },
              ]}
              onChange={(frequency) => set({ frequency })}
            />
          </F>
          {f.frequency === "FREQUENCY_WEEKLY" && (
            <F label="Day">
              <Pick label="Fetch day" value={f.dayOfWeek ?? "MONDAY"} options={DAYS.map((d) => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() }))} onChange={(dayOfWeek) => set({ dayOfWeek })} />
            </F>
          )}
          {f.frequency === "FREQUENCY_MONTHLY" && (
            <F label="Day of the month (1–31)">
              <NumInput label="Fetch day of month" min={1} value={f.dayOfMonth} onChange={(n) => set({ dayOfMonth: n })} />
            </F>
          )}
          <F label="Hour (0–23)">
            <NumInput label="Fetch hour" value={f.hour} onChange={(n) => set({ hour: n ?? 0 })} />
          </F>
          <F label="Time zone">
            <Input aria-label="Fetch time zone" placeholder="e.g. Asia/Karachi" value={f.timeZone} onChange={(e) => set({ timeZone: e.target.value })} />
          </F>
          <F label="Username (if the URL needs one)">
            <Input aria-label="Feed username" autoComplete="off" value={f.username} onChange={(e) => set({ username: e.target.value })} />
          </F>
          <F label="Password">
            <Input aria-label="Feed password" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set({ password: e.target.value })} />
          </F>
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !f.displayName.trim() || !f.fetchUri.trim() || !f.feedLabel}>
            {pending && <Spinner data-icon="inline-start" />}
            Add feed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
