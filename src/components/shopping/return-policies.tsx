"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeReturnPolicy, saveReturnPolicy } from "@/lib/actions/merchant";
import { checkReturnPolicy, fromMicros, type ReturnPolicy } from "@/lib/merchant-shipping";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { CsvInput, F, MoneyInput, NumInput, Pick, dropAt, setAt } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type GDate = { year?: number; month?: number; day?: number };
const toInputDate = (d?: GDate) => (d?.year ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : "");
const fromInputDate = (s: string): GDate | undefined => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : undefined;
};

function windowText(p: ReturnPolicy) {
  if (p.policy?.type === "NO_RETURNS") return "No returns";
  if (p.policy?.type === "LIFETIME_RETURNS") return "Lifetime returns";
  return p.policy?.days ? `${p.policy.days} days after delivery` : "—";
}
function feeText(p: ReturnPolicy) {
  const f = p.returnShippingFee;
  if (!f) return "Free return shipping";
  if (f.type === "CUSTOMER_PAYING_ACTUAL_FEE") return "Customer pays return shipping";
  return `Return shipping ${fromMicros(f.fixedFee?.amountMicros)} ${f.fixedFee?.currencyCode ?? ""}`.trim();
}

const METHODS = [
  { value: "BY_MAIL" as const, label: "By mail" },
  { value: "IN_STORE" as const, label: "In store" },
  { value: "AT_A_KIOSK" as const, label: "At a kiosk" },
];
const CONDITIONS = [
  { value: "NEW" as const, label: "New" },
  { value: "USED" as const, label: "Used" },
];

function toggle<T>(list: T[] | undefined, item: T, on: boolean): T[] {
  const rest = (list ?? []).filter((x) => x !== item);
  return on ? [...rest, item] : rest;
}

/** Every field of a return policy. */
function PolicyForm({ value, onChange, isNew }: { value: ReturnPolicy; onChange: (p: ReturnPolicy) => void; isNew: boolean }) {
  const currency = value.returnShippingFee?.fixedFee?.currencyCode ?? value.restockingFee?.fixedFee?.currencyCode ?? "";
  const [feeCurrency, setFeeCurrency] = useState(currency);
  const restocking = value.restockingFee?.microPercent != null ? "percent" : value.restockingFee?.fixedFee ? "fixed" : "none";
  return (
    <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label={isNew ? "Label (optional, can't change later)" : "Label (can't change)"}>
          <Input aria-label="Policy label" disabled={!isNew} value={value.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value || undefined })} />
        </F>
        <F label={isNew ? "Countries (2-letter codes, can't change later)" : "Countries (can't change)"}>
          {isNew ? (
            <CsvInput upper label="Countries" placeholder="e.g. PK, AE" value={value.countries} onChange={(c) => onChange({ ...value, countries: c })} />
          ) : (
            <Input aria-label="Countries" disabled value={(value.countries ?? []).join(", ")} />
          )}
        </F>
        <F label="Return policy page URL" className="sm:col-span-2">
          <Input aria-label="Return policy URL" placeholder="https://…" value={value.returnPolicyUri ?? ""} onChange={(e) => onChange({ ...value, returnPolicyUri: e.target.value })} />
        </F>
        <F label="Return window">
          <Pick
            label="Return window"
            value={value.policy?.type ?? ""}
            options={[
              { value: "NUMBER_OF_DAYS_AFTER_DELIVERY", label: "Days after delivery" },
              { value: "NO_RETURNS", label: "No returns" },
              { value: "LIFETIME_RETURNS", label: "Lifetime returns" },
            ]}
            onChange={(type) => onChange({ ...value, policy: { type, days: type === "NUMBER_OF_DAYS_AFTER_DELIVERY" ? (value.policy?.days ?? "30") : undefined } })}
          />
        </F>
        {value.policy?.type === "NUMBER_OF_DAYS_AFTER_DELIVERY" && (
          <F label="Days">
            <Input aria-label="Return days" inputMode="numeric" value={value.policy.days ?? ""} onChange={(e) => onChange({ ...value, policy: { ...value.policy, days: e.target.value.replace(/\D/g, "") } })} />
          </F>
        )}
        <F label="Item conditions">
          <div className="flex h-9 items-center gap-4">
            {CONDITIONS.map((c) => (
              <label key={c.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={(value.itemConditions ?? []).includes(c.value)} onCheckedChange={(on) => onChange({ ...value, itemConditions: toggle(value.itemConditions, c.value, on === true) })} />
                {c.label}
              </label>
            ))}
          </div>
        </F>
        <F label="Return methods">
          <div className="flex h-9 flex-wrap items-center gap-4">
            {METHODS.map((m) => (
              <label key={m.value} className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={(value.returnMethods ?? []).includes(m.value)} onCheckedChange={(on) => onChange({ ...value, returnMethods: toggle(value.returnMethods, m.value, on === true) })} />
                {m.label}
              </label>
            ))}
          </div>
        </F>
        <F label="Fee currency (3 letters)">
          <Input aria-label="Fee currency" maxLength={3} placeholder="e.g. PKR" value={feeCurrency} onChange={(e) => setFeeCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
        </F>
        <F label="Return shipping">
          <Pick
            label="Return shipping fee"
            value={value.returnShippingFee?.type ?? "FREE"}
            options={[
              { value: "FREE", label: "Free for the customer" },
              { value: "FIXED", label: "Fixed fee" },
              { value: "CUSTOMER_PAYING_ACTUAL_FEE", label: "Customer pays actual cost" },
            ]}
            onChange={(t) => onChange({ ...value, returnShippingFee: t === "FREE" ? undefined : t === "FIXED" ? { type: "FIXED", fixedFee: { amountMicros: "", currencyCode: feeCurrency } } : { type: t } })}
          />
        </F>
        {value.returnShippingFee?.type === "FIXED" && (
          <F label="Return shipping fee">
            <MoneyInput label="Return shipping fee amount" currency={feeCurrency} value={value.returnShippingFee.fixedFee} onChange={(p) => onChange({ ...value, returnShippingFee: { type: "FIXED", fixedFee: p } })} />
          </F>
        )}
        <F label="Restocking fee">
          <Pick
            label="Restocking fee"
            value={restocking}
            options={[
              { value: "none", label: "None" },
              { value: "fixed", label: "Fixed amount" },
              { value: "percent", label: "Percent of price" },
            ]}
            onChange={(m) => onChange({ ...value, restockingFee: m === "none" ? undefined : m === "fixed" ? { fixedFee: { amountMicros: "", currencyCode: feeCurrency } } : { microPercent: 0 } })}
          />
        </F>
        {restocking === "fixed" && (
          <F label="Restocking fee amount">
            <MoneyInput label="Restocking fee amount" currency={feeCurrency} value={value.restockingFee?.fixedFee} onChange={(p) => onChange({ ...value, restockingFee: { fixedFee: p } })} />
          </F>
        )}
        {restocking === "percent" && (
          <F label="Restocking fee (%)">
            <NumInput label="Restocking fee percent" value={value.restockingFee?.microPercent != null ? Math.round(value.restockingFee.microPercent / 1_000_000) : undefined} onChange={(n) => onChange({ ...value, restockingFee: { microPercent: (n ?? 0) * 1_000_000 } })} />
          </F>
        )}
        <F label="Return label">
          <Pick
            label="Return label source"
            value={value.returnLabelSource ?? ""}
            options={[
              { value: "DOWNLOAD_AND_PRINT", label: "Customer downloads and prints" },
              { value: "IN_THE_PACKAGE", label: "Included in the package" },
              { value: "CUSTOMER_RESPONSIBILITY", label: "Customer arranges it" },
            ]}
            onChange={(s) => onChange({ ...value, returnLabelSource: s })}
          />
        </F>
        <F label="Refund processed within (days)">
          <NumInput label="Refund days" value={value.processRefundDays} onChange={(n) => onChange({ ...value, processRefundDays: n })} />
        </F>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.acceptExchange === true} onCheckedChange={(c) => onChange({ ...value, acceptExchange: c === true })} />
          Exchanges accepted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.acceptDefectiveOnly === true} onCheckedChange={(c) => onChange({ ...value, acceptDefectiveOnly: c === true })} />
          Only defective items can be returned
        </label>
      </div>

      <F label="Seasonal overrides (e.g. longer returns over the holidays)">
        {(value.seasonalOverrides ?? []).map((s, i) => {
          const set = (patch: Partial<typeof s>) => onChange({ ...value, seasonalOverrides: setAt(value.seasonalOverrides, i, { ...s, ...patch }) });
          const byDate = s.returnUntilDate != null;
          return (
            <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-3">
              <Input aria-label="Override label" placeholder="Label, e.g. Holidays" value={s.label ?? ""} onChange={(e) => set({ label: e.target.value })} />
              <Input aria-label="Override start" type="date" value={toInputDate(s.startDate)} onChange={(e) => set({ startDate: fromInputDate(e.target.value) })} />
              <Input aria-label="Override end" type="date" value={toInputDate(s.endDate)} onChange={(e) => set({ endDate: fromInputDate(e.target.value) })} />
              <Pick
                label="Override return limit"
                value={byDate ? "date" : "days"}
                options={[
                  { value: "days", label: "Returns within N days" },
                  { value: "date", label: "Returns until a date" },
                ]}
                onChange={(m) => set(m === "date" ? { returnDays: undefined, returnUntilDate: s.endDate ?? {} } : { returnUntilDate: undefined, returnDays: 30 })}
              />
              {byDate ? (
                <Input aria-label="Return until" type="date" value={toInputDate(s.returnUntilDate)} onChange={(e) => set({ returnUntilDate: fromInputDate(e.target.value) })} />
              ) : (
                <NumInput label="Override return days" value={s.returnDays} onChange={(n) => set({ returnDays: n })} />
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, seasonalOverrides: dropAt(value.seasonalOverrides, i) })}>
                <Trash2Icon data-icon="inline-start" />
                Remove
              </Button>
            </div>
          );
        })}
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange({ ...value, seasonalOverrides: [...(value.seasonalOverrides ?? []), { label: "", returnDays: 30 }] })}>
          <PlusIcon data-icon="inline-start" />
          Add seasonal override
        </Button>
      </F>
    </div>
  );
}

/** Return policies: Google has no update, so editing replaces the policy. */
export function ReturnPolicies({ projectId, policies }: { projectId: string; policies: ReturnPolicy[] }) {
  const canCreate = useCan("shipping.create");
  const canEdit = useCan("shipping.edit");
  const canDelete = useCan("shipping.delete");
  const hasActions = canEdit || canDelete;
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ replace?: string; policy: ReturnPolicy } | null>(null);
  const problems = editing ? checkReturnPolicy(editing.policy) : [];

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveReturnPolicy(projectId, editing.policy, editing.replace);
      if (!res.ok) return void toast.error(res.error);
      toast.success(editing.replace ? "Return policy updated." : "Return policy added.");
      setEditing(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Return policies</CardTitle>
        <CardDescription>Shown to shoppers on Google. Each policy covers the countries it lists.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {policies.length === 0 && <p className="text-muted-foreground text-sm">No return policies yet.</p>}
        {policies.map((p) => (
          <div key={p.name} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">
                {p.label || "Return policy"} <span className="text-muted-foreground font-normal">· {(p.countries ?? []).join(", ")}</span>
              </span>
              <span className="text-muted-foreground text-sm">
                {windowText(p)} · {feeText(p)}
                {p.processRefundDays != null ? ` · refund within ${p.processRefundDays} days` : ""}
              </span>
              <div className="flex flex-wrap gap-1">
                {(p.returnMethods ?? []).map((m) => (
                  <Badge key={m} variant="outline">
                    {METHODS.find((x) => x.value === m)?.label ?? m}
                  </Badge>
                ))}
                {(p.seasonalOverrides ?? []).length > 0 && <Badge variant="secondary">{p.seasonalOverrides!.length} seasonal override(s)</Badge>}
              </div>
            </div>
            {hasActions && (
              <div className="flex gap-1">
                {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setEditing({ replace: p.name, policy: structuredClone(p) })}>
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
                )}
                {canDelete && (
<ConfirmDelete
                  triggerRender={<Button size="sm" variant="ghost" disabled={pending} />}
                  title={`Delete the "${p.label || "return"}" policy?`}
                  description="Shoppers in these countries will no longer see return details from this policy."
                  details={[
                    { label: "Countries", value: (p.countries ?? []).join(", ") },
                    { label: "Window", value: windowText(p) },
                    { label: "Return shipping", value: feeText(p) },
                  ]}
                  onConfirm={() =>
                    startTransition(async () => {
                      const res = await removeReturnPolicy(projectId, p.name!);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Return policy deleted.");
                    })
                  }
                >
                  <Trash2Icon data-icon="inline-start" />
                  Delete
                </ConfirmDelete>
)}
              </div>
            )}
          </div>
        ))}
        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setEditing({ policy: { countries: [], policy: { type: "NUMBER_OF_DAYS_AFTER_DELIVERY", days: "30" }, itemConditions: ["NEW"], returnMethods: ["BY_MAIL"], returnPolicyUri: "" } })}
          >
            <PlusIcon data-icon="inline-start" />
            Add return policy
          </Button>
        )}
      </CardContent>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.replace ? "Edit return policy" : "Add return policy"}</DialogTitle>
                <DialogDescription>
                  {editing.replace ? "Google doesn't edit policies in place: saving adds the new version and removes the old one." : "Applies to shoppers in the countries listed."}
                </DialogDescription>
              </DialogHeader>
              <PolicyForm value={editing.policy} isNew={!editing.replace} onChange={(policy) => setEditing({ ...editing, policy })} />
              {problems.length > 0 && <p className="text-destructive text-sm">{problems[0]}</p>}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={pending || problems.length > 0}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Save policy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
