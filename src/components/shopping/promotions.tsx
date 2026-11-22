"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { endPromotion, savePromotion } from "@/lib/actions/merchant";
import { checkPromotion, type PromotionForm } from "@/lib/merchant-promotions";
import { fromMicros } from "@/lib/merchant-shipping";
import type { PromotionDoc } from "@/lib/providers/google";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { F, Pick } from "@/components/shopping/fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = PromotionDoc & { editable: boolean };
type Status = NonNullable<NonNullable<NonNullable<PromotionDoc["promotionStatus"]>["destinationStatuses"]>[number]["status"]>;

const STATUS: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  LIVE: { label: "Live", variant: "secondary" },
  IN_REVIEW: { label: "In review", variant: "outline" },
  PENDING: { label: "Scheduled", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  STOPPED: { label: "Stopped", variant: "outline" },
  EXPIRED: { label: "Ended", variant: "outline" },
};
const DEST: Record<string, string> = { SHOPPING_ADS: "Shopping ads", FREE_LISTINGS: "Free listings" };
const words = (s: string) => DEST[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

/** What the shopper gets, in a few words. */
function offer(p: PromotionDoc) {
  const a = p.attributes ?? {};
  const cur = a.moneyOffAmount?.currencyCode ?? a.minimumPurchaseAmount?.currencyCode ?? "";
  const base =
    a.couponValueType === "PERCENT_OFF"
      ? `${a.percentOff}% off`
      : a.couponValueType === "MONEY_OFF"
        ? `${fromMicros(a.moneyOffAmount?.amountMicros)} ${cur} off`
        : a.couponValueType?.startsWith("FREE_SHIPPING")
          ? "Free shipping"
          : words(a.couponValueType ?? "Offer");
  const min = a.minimumPurchaseAmount ? ` on ${fromMicros(a.minimumPurchaseAmount.amountMicros)} ${cur}+` : "";
  const scope = a.productApplicability === "SPECIFIC_PRODUCTS" ? ` · ${(a.itemIdInclusion ?? []).length || "some"} products` : "";
  return base + min + scope;
}

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
/** The end time is exclusive, so the last day shown is the day before. */
const lastDay = (iso?: string) => (iso ? day(new Date(new Date(iso).getTime() - 1).toISOString()) : "—");
const isOver = (p: PromotionDoc) => {
  const end = p.attributes?.promotionEffectiveTimePeriod?.endTime;
  return end ? new Date(end) <= new Date() : false;
};

/** Promotions shown with products on Google, and a form to start a new one. */
export function Promotions({ projectId, promotions }: { projectId: string; promotions: Row[] }) {
  const canCreate = useCan("promotions.create");
  const canEdit = useCan("promotions.edit");
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const pages = usePaged(promotions);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Promotions</CardTitle>
        <CardDescription>Offers shown with the products on Google. Google reviews each one before it goes live.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {promotions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No promotions yet.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Promotion</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-24" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.shown.map((p) => {
                  const a = p.attributes ?? {};
                  const issues = p.promotionStatus?.itemLevelIssues ?? [];
                  return (
                    <TableRow key={p.name}>
                      <TableCell className="max-w-sm align-top">
                        <span className="block font-medium">{a.longTitle || p.promotionId}</span>
                        <span className="text-muted-foreground block text-xs">
                          {offer(p)}
                          {a.genericRedemptionCode ? ` · code ${a.genericRedemptionCode}` : ""} · {p.targetCountry}/{p.contentLanguage} · {p.promotionId}
                        </span>
                        {issues.slice(0, 2).map((i, k) => (
                          <span key={k} className={i.severity === "DISAPPROVED" ? "text-destructive block text-xs" : "text-muted-foreground block text-xs"}>
                            {i.description}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="align-top text-sm whitespace-nowrap">
                        {day(a.promotionEffectiveTimePeriod?.startTime)} – {lastDay(a.promotionEffectiveTimePeriod?.endTime)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          {(p.promotionStatus?.destinationStatuses ?? []).map((d) => {
                            const st = STATUS[(d.status as Status) ?? ""] ?? { label: "Unknown", variant: "outline" as const };
                            return (
                              <span key={d.reportingContext} className="flex items-center gap-1.5 text-xs">
                                <Badge variant={st.variant}>{st.label}</Badge>
                                {words(d.reportingContext ?? "")}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right align-top">
                          {p.editable && !isOver(p) && (
                            <ConfirmDelete
                              triggerRender={<Button size="sm" variant="ghost" disabled={pending} />}
                              title={`End "${a.longTitle || p.promotionId}" now?`}
                              description="It stops showing on Google. Google can't delete promotions, so it stays listed as ended."
                              details={[
                                { label: "Offer", value: offer(p) },
                                { label: "Ends", value: lastDay(a.promotionEffectiveTimePeriod?.endTime) },
                              ]}
                              confirmLabel="End now"
                              onConfirm={() =>
                                startTransition(async () => {
                                  const res = await endPromotion(projectId, p.name!);
                                  if (!res.ok) return void toast.error(res.error);
                                  toast.success("Promotion ended.");
                                })
                              }
                            >
                              End now
                            </ConfirmDelete>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePager page={pages.page} total={promotions.length} onPage={pages.setPage} />
          </>
        )}
        {canCreate && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <PlusIcon data-icon="inline-start" />
            New promotion
          </Button>
        )}
      </CardContent>
      {adding && <PromotionDialog projectId={projectId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

function PromotionDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [f, setF] = useState<PromotionForm>({
    promotionId: "",
    longTitle: "",
    targetCountry: "",
    contentLanguage: "en",
    kind: "PERCENT_OFF",
    percentOff: "10",
    moneyOff: "",
    currency: "",
    minimumPurchase: "",
    code: "",
    start: today(),
    end: inDays(14),
    itemIds: "",
    destinations: ["FREE_LISTINGS", "SHOPPING_ADS"],
    promotionUrl: "",
  });
  const set = (p: Partial<PromotionForm>) => setF({ ...f, ...p });
  const [pending, startTransition] = useTransition();
  const [tried, setTried] = useState(false);
  const problems = checkPromotion(f);
  const toggle = (d: PromotionForm["destinations"][number], on: boolean) => set({ destinations: on ? [...f.destinations, d] : f.destinations.filter((x) => x !== d) });

  function save() {
    setTried(true);
    if (problems.length) return;
    startTransition(async () => {
      const res = await savePromotion(projectId, f);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Promotion sent. Google reviews it before it goes live.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New promotion</DialogTitle>
          <DialogDescription>Shown next to matching products on Google once approved. Using an existing ID replaces that promotion.</DialogDescription>
        </DialogHeader>
        <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
          <F label="Title shoppers see (up to 60 characters)" className="sm:col-span-2">
            <Input aria-label="Promotion title" placeholder="e.g. 10% off all cakes" value={f.longTitle} onChange={(e) => set({ longTitle: e.target.value })} />
          </F>
          <F label="Promotion ID">
            <Input aria-label="Promotion ID" placeholder="e.g. summer-10" value={f.promotionId} onChange={(e) => set({ promotionId: e.target.value.replace(/\s/g, "-") })} />
          </F>
          <F label="Country / language">
            <div className="flex gap-2">
              <Input aria-label="Promotion country" placeholder="PK" maxLength={2} value={f.targetCountry} onChange={(e) => set({ targetCountry: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
              <Input aria-label="Promotion language" maxLength={2} value={f.contentLanguage} onChange={(e) => set({ contentLanguage: e.target.value.toLowerCase().replace(/[^a-z]/g, "") })} />
            </div>
          </F>
          <F label="Offer">
            <Pick
              label="Offer type"
              value={f.kind}
              options={[
                { value: "PERCENT_OFF" as const, label: "Percent off" },
                { value: "MONEY_OFF" as const, label: "Amount off" },
                { value: "FREE_SHIPPING_STANDARD" as const, label: "Free shipping" },
              ]}
              onChange={(kind) => set({ kind })}
            />
          </F>
          {f.kind === "PERCENT_OFF" && (
            <F label="Percent off">
              <Input aria-label="Percent off" inputMode="numeric" value={f.percentOff} onChange={(e) => set({ percentOff: e.target.value.replace(/\D/g, "") })} />
            </F>
          )}
          {f.kind === "MONEY_OFF" && (
            <F label="Amount off">
              <Input aria-label="Amount off" inputMode="decimal" value={f.moneyOff} onChange={(e) => set({ moneyOff: e.target.value.replace(/[^\d.]/g, "") })} />
            </F>
          )}
          {f.kind === "FREE_SHIPPING_STANDARD" && <div />}
          <F label="Minimum purchase (optional)">
            <Input aria-label="Minimum purchase" inputMode="decimal" value={f.minimumPurchase} onChange={(e) => set({ minimumPurchase: e.target.value.replace(/[^\d.]/g, "") })} />
          </F>
          <F label="Currency (3 letters)">
            <Input aria-label="Promotion currency" maxLength={3} placeholder="PKR" value={f.currency} onChange={(e) => set({ currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
          </F>
          <F label="Starts">
            <Input aria-label="Start date" type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} />
          </F>
          <F label="Ends (last day)">
            <Input aria-label="End date" type="date" value={f.end} onChange={(e) => set({ end: e.target.value })} />
          </F>
          <F label="Code (optional; empty means no code needed)">
            <Input aria-label="Promotion code" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })} />
          </F>
          <F label="Product IDs (optional; empty means all products)">
            <Input aria-label="Product IDs" placeholder="e.g. cake-1, cake-2" value={f.itemIds} onChange={(e) => set({ itemIds: e.target.value })} />
          </F>
          <F label="Promotion page (optional)" className="sm:col-span-2">
            <Input aria-label="Promotion page" placeholder="https://…" value={f.promotionUrl} onChange={(e) => set({ promotionUrl: e.target.value })} />
          </F>
          <F label="Shows in" className="sm:col-span-2">
            <div className="flex gap-4">
              {(["FREE_LISTINGS", "SHOPPING_ADS"] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <Checkbox aria-label={DEST[d]} checked={f.destinations.includes(d)} onCheckedChange={(c) => toggle(d, c === true)} />
                  {DEST[d]}
                </label>
              ))}
            </div>
          </F>
        </fieldset>
        {tried && problems.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Send promotion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
