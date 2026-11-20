"use client";

import { ExternalLinkIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addProduct, deleteProduct, getProductDetail, revertProductEdits, saveProductEdits } from "@/lib/actions/merchant";
import { AVAILABILITY, CONDITION, changedFields, checkProduct, toForm, type ProductForm } from "@/lib/merchant-products";
import type { ProductDoc, ProductHealthStatus } from "@/lib/providers/google";
import type { CatalogueRow } from "@/lib/shopping";
import { STATUS_LABEL } from "@/lib/shopping-labels";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { F, Pick } from "@/components/shopping/fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const STATUS_BADGE: Record<ProductHealthStatus, "secondary" | "outline" | "destructive"> = { APPROVED: "secondary", LIMITED: "outline", PENDING: "outline", DISAPPROVED: "destructive" };
const words = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");
const httpsOnly = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : undefined);

type Filter = "all" | ProductHealthStatus;

/** The whole catalogue: search, filter by status, open a product to see and edit it. */
export function Catalogue({ projectId, rows, truncated }: { projectId: string; rows: CatalogueRow[]; truncated: boolean }) {
  const canEdit = useCan("merchant.manage");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (filter === "all" || r.status === filter) && (!t || r.title.toLowerCase().includes(t) || r.offerId.toLowerCase().includes(t)));
  }, [rows, q, filter]);
  const pages = usePaged(shown);
  const count = (s: ProductHealthStatus) => rows.filter((r) => r.status === s).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input aria-label="Search products" placeholder="Search title or ID" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Pick
            label="Status"
            className="sm:w-48"
            value={filter}
            options={[
              { value: "all" as Filter, label: `All statuses (${rows.length})` },
              ...(["APPROVED", "LIMITED", "PENDING", "DISAPPROVED"] as const).map((s) => ({ value: s as Filter, label: `${STATUS_LABEL[s]} (${count(s)})` })),
            ]}
            onChange={setFilter}
          />
          {canEdit && (
            <Button variant="outline" className="sm:ml-auto" onClick={() => setAdding(true)}>
              <PlusIcon data-icon="inline-start" />
              Add product
            </Button>
          )}
        </div>
        {truncated && <p className="text-muted-foreground text-xs">Showing the first {rows.length.toLocaleString()} products.</p>}
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">{rows.length ? "No products match." : "No products in this account yet."}</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.shown.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="max-w-md">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => setOpen(r.name)}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- product images are on the store's own hosts */}
                        {r.imageLink ? <img src={r.imageLink} alt="" className="size-9 shrink-0 rounded object-cover" loading="lazy" /> : <span className="bg-muted size-9 shrink-0 rounded" />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{r.title}</span>
                          <span className="text-muted-foreground block text-xs">{r.offerId}</span>
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>{r.availability ? words(r.availability) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.issues}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager page={pages.page} total={shown.length} onPage={pages.setPage} />
          </>
        )}
      </CardContent>

      <Sheet open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto data-[side=right]:sm:max-w-xl">{open && <ProductPanel key={open} projectId={projectId} name={open} onGone={() => setOpen(null)} />}</SheetContent>
      </Sheet>
      {adding && <AddProductDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function ProductFields({ value, onChange }: { value: ProductForm; onChange: (f: ProductForm) => void }) {
  const set = (p: Partial<ProductForm>) => onChange({ ...value, ...p });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <F label="Title" className="sm:col-span-2">
        <Input aria-label="Title" value={value.title} onChange={(e) => set({ title: e.target.value })} />
      </F>
      <F label="Description" className="sm:col-span-2">
        <Textarea aria-label="Description" rows={4} value={value.description} onChange={(e) => set({ description: e.target.value })} />
      </F>
      <F label="Product page link" className="sm:col-span-2">
        <Input aria-label="Product link" placeholder="https://…" value={value.link} onChange={(e) => set({ link: e.target.value })} />
      </F>
      <F label="Image link" className="sm:col-span-2">
        <Input aria-label="Image link" placeholder="https://…" value={value.imageLink} onChange={(e) => set({ imageLink: e.target.value })} />
      </F>
      <F label="Price">
        <Input aria-label="Price" inputMode="decimal" value={value.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, "") })} />
      </F>
      <F label="Sale price (optional)">
        <Input aria-label="Sale price" inputMode="decimal" value={value.salePrice} onChange={(e) => set({ salePrice: e.target.value.replace(/[^\d.]/g, "") })} />
      </F>
      <F label="Currency (3 letters)">
        <Input aria-label="Currency" maxLength={3} value={value.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
      </F>
      <F label="Availability">
        <Pick label="Availability" value={value.availability} options={AVAILABILITY.map((a) => ({ value: a as string, label: words(a) }))} onChange={(availability) => set({ availability })} />
      </F>
      <F label="Condition">
        <Pick label="Condition" value={value.condition} options={CONDITION.map((c) => ({ value: c as string, label: words(c) }))} onChange={(condition) => set({ condition })} />
      </F>
      <F label="Brand">
        <Input aria-label="Brand" value={value.brand} onChange={(e) => set({ brand: e.target.value })} />
      </F>
      <F label="GTINs, comma separated" className="sm:col-span-2">
        <Input aria-label="GTINs" value={value.gtins} onChange={(e) => set({ gtins: e.target.value })} />
      </F>
    </div>
  );
}

function Problems({ list }: { list: string[] }) {
  if (!list.length) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>
        <ul className="list-disc pl-4">
          {list.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

type Detail = ProductDoc & { ours: boolean };

/** One product: its status per destination, its issues, and (with the permission) an editor. */
function ProductPanel({ projectId, name, onGone }: { projectId: string; name: string; onGone: () => void }) {
  const canEdit = useCan("merchant.manage");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, startLoading] = useTransition();

  const load = () =>
    startLoading(async () => {
      const res = await getProductDetail(projectId, name);
      if (!res.ok) return void setError(res.error);
      setDetail(res.data);
      setForm(toForm(res.data.productAttributes));
    });
  // Load when the panel opens (it's keyed by product, so this runs once per product)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const before = useMemo(() => toForm(detail?.productAttributes), [detail]);
  const dirty = form ? changedFields(before, form).length > 0 : false;
  const problems = form && dirty ? checkProduct(form, { isNew: false }) : [];
  const attrs = detail?.productAttributes ?? {};
  const title = (attrs.title as string) || detail?.offerId || "Product";

  function write(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, reload = true) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      if (reload) load();
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{detail ? `${detail.offerId} · ${detail.contentLanguage}/${detail.feedLabel}` : "Loading…"}</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-5 px-4 pb-6">
        {error && <p className="text-destructive text-sm">{error}</p>}
        {loading && !detail && <Spinner />}
        {detail && form && (
          <>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Where it shows</h3>
              {(detail.productStatus?.destinationStatuses ?? []).length === 0 && <p className="text-muted-foreground text-sm">No destinations reported yet.</p>}
              {(detail.productStatus?.destinationStatuses ?? []).map((d) => (
                <div key={d.reportingContext} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="w-40 shrink-0">{words(d.reportingContext ?? "")}</span>
                  {(d.approvedCountries ?? []).length > 0 && <Badge variant="secondary">Approved {d.approvedCountries!.join(", ")}</Badge>}
                  {(d.pendingCountries ?? []).length > 0 && <Badge variant="outline">Pending {d.pendingCountries!.join(", ")}</Badge>}
                  {(d.disapprovedCountries ?? []).length > 0 && <Badge variant="destructive">Disapproved {d.disapprovedCountries!.join(", ")}</Badge>}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Issues</h3>
              {(detail.productStatus?.itemLevelIssues ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No issues.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {detail.productStatus!.itemLevelIssues!.map((i, k) => (
                    <li key={k}>
                      <span className="font-medium">{i.description ?? i.code}</span>
                      {i.attribute && <span className="text-muted-foreground"> · {i.attribute}</span>}
                      {i.detail && <span className="text-muted-foreground block text-xs">{i.detail}</span>}
                      {httpsOnly(i.documentation) && (
                        <a href={httpsOnly(i.documentation)} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-xs underline underline-offset-2">
                          How to fix <ExternalLinkIcon className="size-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Details</h3>
              {canEdit && !detail.ours && (
                <p className="text-muted-foreground text-xs">This product comes from a feed. Changes saved here override the feed&apos;s values for the fields you change, until you revert them. They can take a few minutes to show.</p>
              )}
              <fieldset disabled={!canEdit || pending} className="flex flex-col gap-3">
                <ProductFields value={form} onChange={setForm} />
              </fieldset>
              {canEdit && (
                <>
                  <Problems list={problems} />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={pending || !dirty || problems.length > 0} onClick={() => write(() => saveProductEdits(projectId, name, before, form), "Product saved. Google may take a few minutes to update it.")}>
                      {pending && <Spinner data-icon="inline-start" />}
                      Save changes
                    </Button>
                    <Button variant="ghost" disabled={pending || !dirty} onClick={() => setForm(before)}>
                      Discard
                    </Button>
                    {!detail.ours && (
                      <ConfirmDelete
                        triggerRender={<Button variant="outline" disabled={pending} />}
                        title="Revert edits made in Seo Engine?"
                        description="Every value changed here is removed, and the product shows its feed's values again."
                        details={[{ label: "Product", value: detail.offerId }]}
                        confirmLabel="Revert"
                        onConfirm={() => write(() => revertProductEdits(projectId, name), "Edits reverted. Google may take a few minutes to update it.")}
                      >
                        Revert my edits
                      </ConfirmDelete>
                    )}
                    {detail.ours && (
                      <ConfirmDelete
                        triggerRender={<Button variant="outline" disabled={pending} />}
                        title={`Delete "${title}"?`}
                        description="It's removed from Merchant Center and stops showing on Google."
                        details={[
                          { label: "Product ID", value: detail.offerId },
                          { label: "Language / label", value: `${detail.contentLanguage}/${detail.feedLabel}` },
                        ]}
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await deleteProduct(projectId, name);
                            if (!res.ok) return void toast.error(res.error);
                            toast.success("Product deleted.");
                            onGone();
                          })
                        }
                      >
                        Delete product
                      </ConfirmDelete>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function AddProductDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [offerId, setOfferId] = useState("");
  const [lang, setLang] = useState("en");
  const [label, setLabel] = useState("");
  const [form, setForm] = useState<ProductForm>({ ...toForm(undefined), availability: "IN_STOCK", condition: "NEW" });
  const [pending, startTransition] = useTransition();
  const [tried, setTried] = useState(false);
  const problems = checkProduct(form, { isNew: true });

  function save() {
    setTried(true);
    if (problems.length) return;
    startTransition(async () => {
      const res = await addProduct(projectId, { offerId, contentLanguage: lang, feedLabel: label, form });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Product added. Google reviews it before it shows.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>Added to the &quot;Seo Engine products&quot; data source in Merchant Center. Google reviews it before it shows.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Product ID (your SKU)">
              <Input aria-label="Product ID" value={offerId} onChange={(e) => setOfferId(e.target.value)} />
            </F>
            <F label="Language (2 letters)">
              <Input aria-label="Language" maxLength={2} value={lang} onChange={(e) => setLang(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))} />
            </F>
            <F label="Feed label (usually the country)">
              <Input aria-label="Feed label" placeholder="e.g. PK" maxLength={20} value={label} onChange={(e) => setLabel(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} />
            </F>
          </div>
          <ProductFields value={form} onChange={setForm} />
          {tried && <Problems list={problems} />}
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !offerId.trim() || !label}>
            {pending && <Spinner data-icon="inline-start" />}
            Add product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
