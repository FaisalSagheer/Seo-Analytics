"use client";

import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useCan } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { describeValue, type DeliveryTime, type RateGroup, type Service, type Table, type Warehouse } from "@/lib/merchant-shipping";
import { CsvInput, DaysPicker, F, MoneyInput, NumInput, Pick, dropAt, setAt } from "@/components/shopping/fields";
import { TableEditor, TransitTableEditor, ValueEditor, type RateContext } from "@/components/shopping/table-editor";

type Regions = { id: string; label: string }[];

const SHIPMENT_TYPES = [
  { value: "DELIVERY" as const, label: "Delivery to an address" },
  { value: "LOCAL_DELIVERY" as const, label: "Local delivery from stores" },
  { value: "COLLECTION_POINT" as const, label: "Collection point" },
];

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  // A read-only view sits in a disabled fieldset, so its toggles can't be clicked: show it all open.
  const canEdit = useCan("shipping.edit");
  const [open, setOpen] = useState(defaultOpen || !canEdit);
  return (
    <div className="rounded-md border">
      <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {title}
        <ChevronDownIcon className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="flex flex-col gap-4 border-t p-3">{children}</div>}
    </div>
  );
}

/** Handling and transit days, cutoff, business days, transit table, per-warehouse times. */
function DeliveryTimeEditor({ value, onChange, regions, warehouses }: { value: DeliveryTime; onChange: (d: DeliveryTime) => void; regions: Regions; warehouses: Warehouse[] }) {
  const useTable = value.transitTimeTable != null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <F label="Handling days (min)">
          <NumInput label="Minimum handling days" value={value.minHandlingDays} onChange={(n) => onChange({ ...value, minHandlingDays: n })} />
        </F>
        <F label="Handling days (max)">
          <NumInput label="Maximum handling days" value={value.maxHandlingDays} onChange={(n) => onChange({ ...value, maxHandlingDays: n })} />
        </F>
        {!useTable && (
          <>
            <F label="Transit days (min)">
              <NumInput label="Minimum transit days" value={value.minTransitDays} onChange={(n) => onChange({ ...value, minTransitDays: n })} />
            </F>
            <F label="Transit days (max)">
              <NumInput label="Maximum transit days" value={value.maxTransitDays} onChange={(n) => onChange({ ...value, maxTransitDays: n })} />
            </F>
          </>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={useTable}
          onCheckedChange={(c) =>
            onChange(c === true ? { ...value, minTransitDays: undefined, maxTransitDays: undefined, transitTimeTable: { postalCodeGroupNames: [], transitTimeLabels: [], rows: [] } } : { ...value, transitTimeTable: undefined })
          }
        />
        Transit days differ by region or label (transit-time table)
      </label>
      {useTable && <TransitTableEditor value={value.transitTimeTable!} onChange={(t) => onChange({ ...value, transitTimeTable: t })} regions={regions} />}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.cutoffTime != null} onCheckedChange={(c) => onChange({ ...value, cutoffTime: c === true ? { hour: 16, minute: 0, timeZone: "" } : undefined })} />
          Order cutoff time (otherwise 8 AM Pacific)
        </label>
        {value.cutoffTime && (
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Hour (0–23)">
              <NumInput label="Cutoff hour" value={value.cutoffTime.hour} onChange={(n) => onChange({ ...value, cutoffTime: { ...value.cutoffTime, hour: n } })} />
            </F>
            <F label="Minute">
              <NumInput label="Cutoff minute" value={value.cutoffTime.minute} onChange={(n) => onChange({ ...value, cutoffTime: { ...value.cutoffTime, minute: n } })} />
            </F>
            <F label="Time zone">
              <Input aria-label="Cutoff time zone" placeholder="e.g. Asia/Karachi" value={value.cutoffTime.timeZone ?? ""} onChange={(e) => onChange({ ...value, cutoffTime: { ...value.cutoffTime, timeZone: e.target.value } })} />
            </F>
          </div>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Handling business days">
          <DaysPicker label="Handling business days" value={value.handlingBusinessDayConfig} onChange={(d) => onChange({ ...value, handlingBusinessDayConfig: d })} />
        </F>
        <F label="Transit business days">
          <DaysPicker label="Transit business days" value={value.transitBusinessDayConfig} onChange={(d) => onChange({ ...value, transitBusinessDayConfig: d })} />
        </F>
      </div>
      <F label="Delivery time by warehouse and carrier (optional)">
        {(value.warehouseBasedDeliveryTimes ?? []).map((w, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Pick
              label="Warehouse"
              className="w-44"
              value={w.warehouse ?? ""}
              options={warehouses.map((x) => ({ value: x.name ?? "", label: x.name ?? "" })).filter((o) => o.value)}
              onChange={(v) => onChange({ ...value, warehouseBasedDeliveryTimes: setAt(value.warehouseBasedDeliveryTimes, i, { ...w, warehouse: v }) })}
            />
            <Input aria-label="Carrier" placeholder="Carrier, e.g. UPS" className="w-36" value={w.carrier ?? ""} onChange={(e) => onChange({ ...value, warehouseBasedDeliveryTimes: setAt(value.warehouseBasedDeliveryTimes, i, { ...w, carrier: e.target.value }) })} />
            <Input aria-label="Carrier service" placeholder="Service, e.g. ground" className="w-36" value={w.carrierService ?? ""} onChange={(e) => onChange({ ...value, warehouseBasedDeliveryTimes: setAt(value.warehouseBasedDeliveryTimes, i, { ...w, carrierService: e.target.value }) })} />
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove warehouse delivery time" onClick={() => onChange({ ...value, warehouseBasedDeliveryTimes: dropAt(value.warehouseBasedDeliveryTimes, i) })}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={warehouses.length === 0}
          onClick={() => onChange({ ...value, warehouseBasedDeliveryTimes: [...(value.warehouseBasedDeliveryTimes ?? []), { warehouse: warehouses[0]?.name, carrier: "", carrierService: "" }] })}
        >
          <PlusIcon data-icon="inline-start" />
          {warehouses.length ? "Add warehouse delivery time" : "Add a warehouse first"}
        </Button>
      </F>
    </div>
  );
}

/** Which products a rate group covers (shipping labels), its carrier rates, and its rate or tables. */
function RateGroupEditor({ value, onChange, currency, regions, last }: { value: RateGroup; onChange: (g: RateGroup) => void; currency?: string; regions: Regions; last: boolean }) {
  const ctx: RateContext = {
    currency,
    carriers: (value.carrierRates ?? []).map((c) => c.name ?? "").filter(Boolean),
    subtables: (value.subtables ?? []).map((t) => t.name ?? "").filter(Boolean),
    regions,
  };
  const mode = value.mainTable ? "table" : "single";
  const newTable = (name?: string): Table => ({ name, rowHeaders: { prices: [{ amountMicros: "-1", currencyCode: currency }] }, rows: [{ cells: [{ flatRate: { amountMicros: "0", currencyCode: currency } }] }] });
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <F label="Rate group name (optional)">
          <Input aria-label="Rate group name" value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value || undefined })} />
        </F>
        <F label={last ? "Shipping labels (empty = everything else)" : "Shipping labels"}>
          <CsvInput label="Shipping labels" placeholder="e.g. bulky, fragile" value={value.applicableShippingLabels} onChange={(l) => onChange({ ...value, applicableShippingLabels: l })} />
        </F>
      </div>

      <F label="Carrier rates (calculated by the carrier)">
        {(value.carrierRates ?? []).map((c, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-3">
            <Input aria-label="Carrier rate name" placeholder="Name, e.g. ups-ground" value={c.name ?? ""} onChange={(e) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, name: e.target.value }) })} />
            <Input aria-label="Carrier" placeholder="Carrier, e.g. UPS" value={c.carrier ?? ""} onChange={(e) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, carrier: e.target.value }) })} />
            <Input aria-label="Carrier service" placeholder="Service, e.g. ground" value={c.carrierService ?? ""} onChange={(e) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, carrierService: e.target.value }) })} />
            <Input aria-label="Origin postal code" placeholder="Ships from postal code" value={c.originPostalCode ?? ""} onChange={(e) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, originPostalCode: e.target.value }) })} />
            <Input
              aria-label="Percentage adjustment"
              placeholder="% adjustment, e.g. 5 or -3"
              value={c.percentageAdjustment ?? ""}
              onChange={(e) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, percentageAdjustment: e.target.value.replace(/[^\d.-]/g, "") || undefined }) })}
            />
            <div className="flex items-center gap-1">
              <MoneyInput label="Flat adjustment" allowNegative currency={currency} value={c.flatAdjustment} onChange={(p) => onChange({ ...value, carrierRates: setAt(value.carrierRates, i, { ...c, flatAdjustment: p }) })} />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove carrier rate" onClick={() => onChange({ ...value, carrierRates: dropAt(value.carrierRates, i) })}>
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange({ ...value, carrierRates: [...(value.carrierRates ?? []), { name: "", carrier: "", carrierService: "", originPostalCode: "" }] })}>
          <PlusIcon data-icon="inline-start" />
          Add carrier rate
        </Button>
      </F>

      <F label="Rate">
        <Pick
          label="Rate type"
          className="sm:w-72"
          value={mode}
          options={[
            { value: "single", label: "One rate for everything" },
            { value: "table", label: "A table (by price, weight, items, region…)" },
          ]}
          onChange={(m) =>
            onChange(m === "single" ? { ...value, mainTable: undefined, subtables: undefined, singleValue: { flatRate: { amountMicros: "0", currencyCode: currency } } } : { ...value, singleValue: undefined, mainTable: newTable() })
          }
        />
      </F>
      {mode === "single" ? (
        <div className="sm:w-72">
          <ValueEditor inTable={false} ctx={ctx} value={value.singleValue} onChange={(v) => onChange({ ...value, singleValue: v })} />
        </div>
      ) : (
        <>
          <TableEditor value={value.mainTable!} onChange={(t) => onChange({ ...value, mainTable: t })} ctx={ctx} title={<span className="text-sm font-medium">Main table</span>} />
          {(value.subtables ?? []).map((t, i) => (
            <TableEditor
              key={i}
              value={t}
              ctx={ctx}
              onChange={(nt) => onChange({ ...value, subtables: setAt(value.subtables, i, nt) })}
              title={
                <div className="flex items-center gap-2">
                  <Input aria-label="Subtable name" className="w-48" placeholder="Subtable name" value={t.name ?? ""} onChange={(e) => onChange({ ...value, subtables: setAt(value.subtables, i, { ...t, name: e.target.value }) })} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, subtables: dropAt(value.subtables, i) })}>
                    <Trash2Icon data-icon="inline-start" />
                    Remove subtable
                  </Button>
                </div>
              }
            />
          ))}
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange({ ...value, subtables: [...(value.subtables ?? []), newTable(`subtable-${(value.subtables?.length ?? 0) + 1}`)] })}>
            <PlusIcon data-icon="inline-start" />
            Add subtable
          </Button>
        </>
      )}
    </div>
  );
}

/** A one-line summary of a service for its collapsed header. */
function summary(s: Service) {
  const dt = s.deliveryTime;
  const days = dt?.transitTimeTable ? "transit by region" : dt?.minTransitDays != null || dt?.maxTransitDays != null ? `${dt?.minTransitDays ?? "?"}–${dt?.maxTransitDays ?? "?"} days` : "";
  const rate = (s.rateGroups ?? []).length === 1 && s.rateGroups![0].singleValue ? describeValue(s.rateGroups![0].singleValue) : `${(s.rateGroups ?? []).length} rate group(s)`;
  return [(s.deliveryCountries ?? []).join(", "), days, rate].filter(Boolean).join(" · ");
}

/** One shipping service, fully editable. */
export function ServiceEditor({
  value,
  onChange,
  onRemove,
  regions,
  warehouses,
}: {
  value: Service;
  onChange: (s: Service) => void;
  onRemove: () => void;
  regions: Regions;
  warehouses: Warehouse[];
}) {
  const canEdit = useCan("shipping.edit");
  const [open, setOpen] = useState(!value.serviceName || !canEdit);
  const cur = value.currencyCode;
  const local = value.shipmentType === "LOCAL_DELIVERY";
  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          <span className="truncate font-medium">{value.serviceName || "Unnamed service"}</span>
          {value.active === false && <Badge variant="outline">Inactive</Badge>}
          <span className="text-muted-foreground truncate text-sm">{summary(value)}</span>
        </button>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
          <Trash2Icon data-icon="inline-start" />
          Remove
        </Button>
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-t p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Service name">
              <Input aria-label="Service name" value={value.serviceName ?? ""} onChange={(e) => onChange({ ...value, serviceName: e.target.value })} />
            </F>
            <F label="Type">
              <Pick label="Shipment type" value={value.shipmentType ?? "DELIVERY"} options={SHIPMENT_TYPES} onChange={(t) => onChange({ ...value, shipmentType: t, storeConfig: t === "LOCAL_DELIVERY" ? value.storeConfig : undefined })} />
            </F>
            <F label="Status">
              <label className="flex h-9 items-center gap-2 text-sm">
                <Checkbox checked={value.active !== false} onCheckedChange={(c) => onChange({ ...value, active: c === true })} />
                Active
              </label>
            </F>
            <F label="Delivery countries (2-letter codes)">
              <CsvInput upper label="Delivery countries" placeholder="e.g. PK, AE" value={value.deliveryCountries} onChange={(c) => onChange({ ...value, deliveryCountries: c })} />
            </F>
            <F label="Currency (3 letters)">
              <Input
                aria-label="Currency"
                placeholder="e.g. PKR"
                maxLength={3}
                value={cur ?? ""}
                onChange={(e) => onChange({ ...value, currencyCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
              />
            </F>
            <F label="Minimum order value (optional)">
              <MoneyInput label="Minimum order value" currency={cur} value={value.minimumOrderValue} onChange={(p) => onChange({ ...value, minimumOrderValue: p })} />
            </F>
          </div>

          {local && (
            <Section title="Stores and local delivery" defaultOpen>
              <div className="grid gap-3 sm:grid-cols-3">
                <F label="Delivers from">
                  <Pick
                    label="Stores"
                    value={value.storeConfig?.storeServiceType ?? "ALL_STORES"}
                    options={[
                      { value: "ALL_STORES", label: "All stores" },
                      { value: "SELECTED_STORES", label: "Selected stores" },
                    ]}
                    onChange={(t) => onChange({ ...value, storeConfig: { ...value.storeConfig, storeServiceType: t, storeCodes: t === "ALL_STORES" ? [] : value.storeConfig?.storeCodes } })}
                  />
                </F>
                {value.storeConfig?.storeServiceType === "SELECTED_STORES" && (
                  <F label="Store codes">
                    <CsvInput label="Store codes" value={value.storeConfig?.storeCodes} onChange={(c) => onChange({ ...value, storeConfig: { ...value.storeConfig, storeCodes: c } })} />
                  </F>
                )}
                <F label="Delivery radius">
                  <div className="flex gap-1.5">
                    <Input
                      aria-label="Delivery radius"
                      inputMode="numeric"
                      value={value.storeConfig?.serviceRadius?.value ?? ""}
                      onChange={(e) => onChange({ ...value, storeConfig: { ...value.storeConfig, serviceRadius: { unit: value.storeConfig?.serviceRadius?.unit ?? "KILOMETERS", value: e.target.value.replace(/\D/g, "") } } })}
                    />
                    <Pick
                      label="Radius unit"
                      className="w-28"
                      value={value.storeConfig?.serviceRadius?.unit ?? "KILOMETERS"}
                      options={[
                        { value: "KILOMETERS", label: "km" },
                        { value: "MILES", label: "miles" },
                      ]}
                      onChange={(unit) => onChange({ ...value, storeConfig: { ...value.storeConfig, serviceRadius: { ...value.storeConfig?.serviceRadius, unit } } })}
                    />
                  </div>
                </F>
                <F label="Same-day cutoff (local time)">
                  <div className="flex items-center gap-1.5">
                    <Input
                      aria-label="Local cutoff hour"
                      placeholder="hour"
                      inputMode="numeric"
                      value={value.storeConfig?.cutoffConfig?.localCutoffTime?.hour ?? ""}
                      onChange={(e) =>
                        onChange({ ...value, storeConfig: { ...value.storeConfig, cutoffConfig: { ...value.storeConfig?.cutoffConfig, localCutoffTime: { ...value.storeConfig?.cutoffConfig?.localCutoffTime, hour: e.target.value.replace(/\D/g, "") } } } })
                      }
                    />
                    :
                    <Input
                      aria-label="Local cutoff minute"
                      placeholder="min"
                      inputMode="numeric"
                      value={value.storeConfig?.cutoffConfig?.localCutoffTime?.minute ?? ""}
                      onChange={(e) =>
                        onChange({ ...value, storeConfig: { ...value.storeConfig, cutoffConfig: { ...value.storeConfig?.cutoffConfig, localCutoffTime: { ...value.storeConfig?.cutoffConfig?.localCutoffTime, minute: e.target.value.replace(/\D/g, "") } } } })
                      }
                    />
                  </div>
                </F>
                <F label="Or: hours before store closes">
                  <Input
                    aria-label="Hours before store closes"
                    inputMode="numeric"
                    value={value.storeConfig?.cutoffConfig?.storeCloseOffsetHours ?? ""}
                    onChange={(e) => onChange({ ...value, storeConfig: { ...value.storeConfig, cutoffConfig: { ...value.storeConfig?.cutoffConfig, storeCloseOffsetHours: e.target.value.replace(/\D/g, "") || undefined } } })}
                  />
                </F>
                <F label="After the cutoff">
                  <label className="flex h-9 items-center gap-2 text-sm">
                    <Checkbox
                      checked={value.storeConfig?.cutoffConfig?.noDeliveryPostCutoff === true}
                      onCheckedChange={(c) => onChange({ ...value, storeConfig: { ...value.storeConfig, cutoffConfig: { ...value.storeConfig?.cutoffConfig, noDeliveryPostCutoff: c === true } } })}
                    />
                    No delivery that day
                  </label>
                </F>
              </div>
              <F label="Minimum order value per store set (pickup)">
                {(value.minimumOrderValueTable?.storeCodeSetWithMovs ?? []).map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <div className="w-60">
                      <CsvInput
                        label="Store codes"
                        placeholder="Store codes (empty = the rest)"
                        value={m.storeCodes}
                        onChange={(c) => onChange({ ...value, minimumOrderValueTable: { storeCodeSetWithMovs: setAt(value.minimumOrderValueTable?.storeCodeSetWithMovs, i, { ...m, storeCodes: c }) } })}
                      />
                    </div>
                    <div className="w-44">
                      <MoneyInput
                        label="Minimum order value"
                        currency={cur}
                        value={m.value}
                        onChange={(p) => onChange({ ...value, minimumOrderValueTable: { storeCodeSetWithMovs: setAt(value.minimumOrderValueTable?.storeCodeSetWithMovs, i, { ...m, value: p }) } })}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove store minimum"
                      onClick={() => {
                        const rest = dropAt(value.minimumOrderValueTable?.storeCodeSetWithMovs, i);
                        onChange({ ...value, minimumOrderValueTable: rest.length ? { storeCodeSetWithMovs: rest } : undefined });
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="self-start"
                  onClick={() =>
                    onChange({
                      ...value,
                      minimumOrderValue: undefined,
                      minimumOrderValueTable: { storeCodeSetWithMovs: [...(value.minimumOrderValueTable?.storeCodeSetWithMovs ?? []), { storeCodes: [], value: { amountMicros: "", currencyCode: cur } }] },
                    })
                  }
                >
                  <PlusIcon data-icon="inline-start" />
                  Add store minimum
                </Button>
              </F>
            </Section>
          )}

          <Section title="Delivery time" defaultOpen>
            <DeliveryTimeEditor value={value.deliveryTime ?? {}} onChange={(d) => onChange({ ...value, deliveryTime: d })} regions={regions} warehouses={warehouses} />
          </Section>

          <Section title={`Rates (${(value.rateGroups ?? []).length} rate group${(value.rateGroups ?? []).length === 1 ? "" : "s"})`} defaultOpen>
            {(value.rateGroups ?? []).map((g, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{g.name || `Rate group ${i + 1}`}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...value, rateGroups: dropAt(value.rateGroups, i) })}>
                    <Trash2Icon data-icon="inline-start" />
                    Remove rate group
                  </Button>
                </div>
                <RateGroupEditor value={g} last={i === (value.rateGroups ?? []).length - 1} currency={cur} regions={regions} onChange={(ng) => onChange({ ...value, rateGroups: setAt(value.rateGroups, i, ng) })} />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              onClick={() => onChange({ ...value, rateGroups: [...(value.rateGroups ?? []), { applicableShippingLabels: [], singleValue: { flatRate: { amountMicros: "0", currencyCode: cur } } }] })}
            >
              <PlusIcon data-icon="inline-start" />
              Add rate group
            </Button>
          </Section>

          <Section title="Loyalty programs (optional)">
            {(value.loyaltyPrograms ?? []).map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Input aria-label="Program label" className="w-48" placeholder="Program label" value={p.programLabel ?? ""} onChange={(e) => onChange({ ...value, loyaltyPrograms: setAt(value.loyaltyPrograms, i, { ...p, programLabel: e.target.value }) })} />
                <div className="w-60">
                  <CsvInput
                    label="Tiers"
                    placeholder="Tier labels, e.g. gold, silver"
                    value={(p.loyaltyProgramTiers ?? []).map((t) => t.tierLabel ?? "")}
                    onChange={(t) => onChange({ ...value, loyaltyPrograms: setAt(value.loyaltyPrograms, i, { ...p, loyaltyProgramTiers: t.map((tierLabel) => ({ tierLabel })) }) })}
                  />
                </div>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove loyalty program" onClick={() => onChange({ ...value, loyaltyPrograms: dropAt(value.loyaltyPrograms, i) })}>
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange({ ...value, loyaltyPrograms: [...(value.loyaltyPrograms ?? []), { programLabel: "", loyaltyProgramTiers: [] }] })}>
              <PlusIcon data-icon="inline-start" />
              Add loyalty program
            </Button>
          </Section>
        </div>
      )}
    </div>
  );
}
