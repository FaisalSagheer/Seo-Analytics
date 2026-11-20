"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { INFINITY_MICROS, toMicros, fromMicros, type Headers, type Table, type TransitTable, type Value } from "@/lib/merchant-shipping";
import { CsvInput, MoneyInput, NumInput, Pick, dropAt, setAt } from "@/components/shopping/fields";

type ValueKind = "flat" | "free" | "percent" | "none" | "carrier" | "subtable";

const kindOf = (v: Value | undefined): ValueKind | "" =>
  !v
    ? ""
    : v.noShipping
      ? "none"
      : v.flatRate
        ? v.flatRate.amountMicros === "0"
          ? "free"
          : "flat"
        : v.pricePercentage != null
          ? "percent"
          : v.carrierRate != null
            ? "carrier"
            : v.subtable != null
              ? "subtable"
              : "";

export type RateContext = { currency?: string; carriers: string[]; subtables: string[]; regions: { id: string; label: string }[] };

/** One shipping rate: flat, free, % of price, no shipping, a carrier rate, or (in tables) a subtable. */
export function ValueEditor({ value, onChange, ctx, inTable }: { value: Value | undefined; onChange: (v: Value) => void; ctx: RateContext; inTable: boolean }) {
  const kind = kindOf(value);
  const options: { value: ValueKind; label: string }[] = [
    { value: "flat", label: "Flat rate" },
    { value: "free", label: "Free" },
    { value: "percent", label: "% of price" },
    { value: "none", label: "No shipping" },
    ...(ctx.carriers.length ? [{ value: "carrier" as const, label: "Carrier rate" }] : []),
    ...(inTable && ctx.subtables.length ? [{ value: "subtable" as const, label: "Subtable" }] : []),
  ];
  const start = (k: ValueKind): Value =>
    k === "flat"
      ? { flatRate: { amountMicros: "", currencyCode: ctx.currency } }
      : k === "free"
        ? { flatRate: { amountMicros: "0", currencyCode: ctx.currency } }
        : k === "percent"
          ? { pricePercentage: "" }
          : k === "none"
            ? { noShipping: true }
            : k === "carrier"
              ? { carrierRate: ctx.carriers[0] }
              : { subtable: ctx.subtables[0] };
  return (
    <div className="flex min-w-40 flex-col gap-1.5">
      <Pick label="Rate" value={kind} options={options} onChange={(k) => onChange(start(k))} />
      {kind === "flat" && <MoneyInput label="Amount" currency={ctx.currency} value={value?.flatRate} onChange={(p) => onChange({ flatRate: p ?? { amountMicros: "", currencyCode: ctx.currency } })} />}
      {kind === "percent" && (
        <Input aria-label="Percent of price" inputMode="decimal" placeholder="e.g. 5.5" value={value?.pricePercentage ?? ""} onChange={(e) => onChange({ pricePercentage: e.target.value.replace(/[^\d.]/g, "") })} />
      )}
      {kind === "carrier" && <Pick label="Carrier rate" value={value?.carrierRate ?? ""} options={ctx.carriers.map((c) => ({ value: c, label: c }))} onChange={(c) => onChange({ carrierRate: c })} />}
      {kind === "subtable" && <Pick label="Subtable" value={value?.subtable ?? ""} options={ctx.subtables.map((c) => ({ value: c, label: c }))} onChange={(c) => onChange({ subtable: c })} />}
    </div>
  );
}

type HeaderKind = "prices" | "weights" | "numberOfItems" | "postalCodeGroupNames" | "locations";
const HEADER_KINDS: { value: HeaderKind; label: string }[] = [
  { value: "prices", label: "Order price" },
  { value: "weights", label: "Weight" },
  { value: "numberOfItems", label: "Number of items" },
  { value: "postalCodeGroupNames", label: "Region" },
  { value: "locations", label: "Google location IDs" },
];
export const headerKind = (h: Headers | undefined): HeaderKind | "" => (h ? (HEADER_KINDS.find((k) => h[k.value] != null)?.value ?? "") : "");
export const headerSize = (h: Headers | undefined) =>
  !h ? 1 : (h.prices?.length ?? h.weights?.length ?? h.numberOfItems?.length ?? h.postalCodeGroupNames?.length ?? h.locations?.length ?? 0);

const OTHER = "all other locations";

/** One axis of a rate table: order price, weight, item count, region or location bands. */
function headersEditor({ value, onChange, ctx, axis }: { value: Headers; onChange: (h: Headers) => void; ctx: RateContext; axis: string }) {
  const kind = headerKind(value);
  const size = headerSize(value);
  const blank = (k: HeaderKind): Headers =>
    k === "prices"
      ? { prices: [{ amountMicros: INFINITY_MICROS, currencyCode: ctx.currency }] }
      : k === "weights"
        ? { weights: [{ amountMicros: INFINITY_MICROS, unit: "KILOGRAM" }] }
        : k === "numberOfItems"
          ? { numberOfItems: ["infinity"] }
          : k === "postalCodeGroupNames"
            ? { postalCodeGroupNames: [OTHER] }
            : { locations: [{ locationIds: [] }] };
  // Upper bounds read "up to X"; the last one may be "and above" (infinity)
  const bound = (i: number) => {
    if (kind === "prices") {
      const p = value.prices![i];
      return (
        <BoundInput
          infinite={p.amountMicros === INFINITY_MICROS}
          text={fromMicros(p.amountMicros)}
          unit={ctx.currency ?? ""}
          onChange={(inf, t) => onChange({ prices: setAt(value.prices, i, { amountMicros: inf ? INFINITY_MICROS : (toMicros(t) ?? ""), currencyCode: ctx.currency }) })}
        />
      );
    }
    if (kind === "weights") {
      const w = value.weights![i];
      return (
        <div className="flex items-center gap-1.5">
          <BoundInput infinite={w.amountMicros === INFINITY_MICROS} text={fromMicros(w.amountMicros)} unit="" onChange={(inf, t) => onChange({ weights: setAt(value.weights, i, { ...w, amountMicros: inf ? INFINITY_MICROS : (toMicros(t) ?? "") }) })} />
          <Pick
            label="Unit"
            className="w-20"
            value={w.unit ?? "KILOGRAM"}
            options={[
              { value: "KILOGRAM", label: "kg" },
              { value: "POUND", label: "lb" },
            ]}
            onChange={(unit) => onChange({ weights: (value.weights ?? []).map((x) => ({ ...x, unit })) })}
          />
        </div>
      );
    }
    if (kind === "numberOfItems") {
      const n = value.numberOfItems![i];
      return <BoundInput infinite={n === "infinity"} text={n === "infinity" ? "" : n} unit="items" onChange={(inf, t) => onChange({ numberOfItems: setAt(value.numberOfItems, i, inf ? "infinity" : t.replace(/\D/g, "")) })} />;
    }
    if (kind === "postalCodeGroupNames") {
      return (
        <Pick
          label="Region"
          value={value.postalCodeGroupNames![i]}
          options={[...ctx.regions.map((r) => ({ value: r.id, label: r.label })), { value: OTHER, label: "All other locations" }]}
          onChange={(g) => onChange({ postalCodeGroupNames: setAt(value.postalCodeGroupNames, i, g) })}
        />
      );
    }
    return <CsvInput label="Location IDs" placeholder="e.g. 21137, 21138" value={value.locations![i].locationIds} onChange={(ids) => onChange({ locations: setAt(value.locations, i, { locationIds: ids }) })} />;
  };
  const add = () => {
    if (kind === "prices") onChange({ prices: [{ amountMicros: "", currencyCode: ctx.currency }, ...(value.prices ?? [])] });
    else if (kind === "weights") onChange({ weights: [{ amountMicros: "", unit: value.weights?.[0]?.unit ?? "KILOGRAM" }, ...(value.weights ?? [])] });
    else if (kind === "numberOfItems") onChange({ numberOfItems: ["", ...(value.numberOfItems ?? [])] });
    else if (kind === "postalCodeGroupNames") onChange({ postalCodeGroupNames: [ctx.regions[0]?.id ?? OTHER, ...(value.postalCodeGroupNames ?? [])] });
    else onChange({ locations: [...(value.locations ?? []), { locationIds: [] }] });
  };
  const remove = (i: number) => {
    const k = kind as HeaderKind;
    onChange({ [k]: dropAt(value[k] as unknown[], i) } as Headers);
  };
  return { kind, size, bound, add, remove, picker: <Pick label={`${axis} by`} value={kind} options={HEADER_KINDS} onChange={(k) => onChange(blank(k))} /> };
}

function BoundInput({ infinite, text, unit, onChange }: { infinite: boolean; text: string; unit: string; onChange: (infinite: boolean, text: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {!infinite && <Input aria-label="Up to" inputMode="decimal" value={text} placeholder="up to" onChange={(e) => onChange(false, e.target.value.replace(/[^\d.]/g, ""))} className="w-24" />}
      <label className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
        <Checkbox checked={infinite} onCheckedChange={(c) => onChange(c === true, "")} />
        {infinite ? `and above${unit ? ` (${unit})` : ""}` : unit}
      </label>
    </div>
  );
}

/** Keeps the grid the size its headers say: rows × columns of values, new cells start free. */
function resize(table: Table, ctx: RateContext): Table {
  const rows = headerSize(table.rowHeaders);
  const cols = table.columnHeaders ? headerSize(table.columnHeaders) : 1;
  const fresh = (): Value => ({ flatRate: { amountMicros: "0", currencyCode: ctx.currency } });
  return {
    ...table,
    rows: Array.from({ length: rows }, (_, r) => ({ cells: Array.from({ length: cols }, (_, c) => table.rows?.[r]?.cells?.[c] ?? fresh()) })),
  };
}

/** A rate table (main table or subtable): row bands, optional column bands, a rate in every cell. */
export function TableEditor({ value, onChange, ctx, title }: { value: Table; onChange: (t: Table) => void; ctx: RateContext; title?: React.ReactNode }) {
  const set = (t: Table) => onChange(resize(t, ctx));
  const rowsH = headersEditor({ value: value.rowHeaders ?? {}, onChange: (h) => set({ ...value, rowHeaders: h }), ctx, axis: "Rows" });
  const colsH = value.columnHeaders ? headersEditor({ value: value.columnHeaders, onChange: (h) => set({ ...value, columnHeaders: h }), ctx, axis: "Columns" }) : null;
  const cols = colsH ? colsH.size : 1;
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {title}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">{rowsH.picker}</div>
        {colsH ? (
          <>
            <div className="w-48">{colsH.picker}</div>
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ ...value, columnHeaders: undefined })}>
              Remove columns
            </Button>
          </>
        ) : (
          rowsH.kind && (
            <Button type="button" size="sm" variant="ghost" onClick={() => set({ ...value, columnHeaders: { numberOfItems: ["infinity"] } })}>
              <PlusIcon data-icon="inline-start" />
              Add a second dimension
            </Button>
          )
        )}
      </div>
      {rowsH.kind && (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-1" />
                {Array.from({ length: cols }, (_, c) => (
                  <th key={c} className="p-1 align-bottom font-normal">
                    {colsH ? (
                      <div className="flex items-center gap-1">
                        {colsH.bound(c)}
                        {cols > 1 && (
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove column" onClick={() => colsH.remove(c)}>
                            <Trash2Icon />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Rate</span>
                    )}
                  </th>
                ))}
                {colsH && (
                  <th className="p-1">
                    <Button type="button" size="icon-sm" variant="outline" aria-label="Add column" onClick={colsH.add}>
                      <PlusIcon />
                    </Button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(value.rows ?? []).map((row, r) => (
                <tr key={r} className="border-t">
                  <td className="p-1 align-top">
                    <div className="flex items-center gap-1">
                      {rowsH.bound(r)}
                      {rowsH.size > 1 && (
                        <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove row" onClick={() => rowsH.remove(r)}>
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  </td>
                  {(row.cells ?? []).map((cell, c) => (
                    <td key={c} className="p-1 align-top">
                      <ValueEditor
                        inTable
                        ctx={ctx}
                        value={cell}
                        onChange={(v) => onChange({ ...value, rows: setAt(value.rows, r, { cells: setAt(row.cells, c, v) }) })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" size="sm" variant="outline" className="mt-2" onClick={rowsH.add}>
            <PlusIcon data-icon="inline-start" />
            Add row
          </Button>
        </div>
      )}
    </div>
  );
}

/** Transit days by region (rows) and, optionally, by transit-time label (columns). */
export function TransitTableEditor({ value, onChange, regions }: { value: TransitTable; onChange: (t: TransitTable) => void; regions: { id: string; label: string }[] }) {
  const groups = value.postalCodeGroupNames ?? [];
  const labels = value.transitTimeLabels ?? [];
  const rowKeys = groups.length ? groups : labels;
  const cols = groups.length && labels.length ? labels.length : 1;
  const fit = (t: TransitTable): TransitTable => {
    const g = t.postalCodeGroupNames ?? [];
    const l = t.transitTimeLabels ?? [];
    const rows = g.length ? g.length : l.length;
    const c = g.length && l.length ? l.length : 1;
    return { ...t, rows: Array.from({ length: rows }, (_, r) => ({ values: Array.from({ length: c }, (_, k) => t.rows?.[r]?.values?.[k] ?? { minTransitDays: 1, maxTransitDays: 3 }) })) };
  };
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Regions (rows)</span>
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-1">
              <Pick
                label="Region"
                value={g}
                options={[...regions.map((r) => ({ value: r.id, label: r.label })), { value: OTHER, label: "All other locations" }]}
                onChange={(v) => onChange(fit({ ...value, postalCodeGroupNames: setAt(groups, i, v) }))}
              />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove region" onClick={() => onChange(fit({ ...value, postalCodeGroupNames: dropAt(groups, i) }))}>
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onChange(fit({ ...value, postalCodeGroupNames: [...groups, regions[0]?.id ?? OTHER] }))}>
            <PlusIcon data-icon="inline-start" />
            Add region
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">Transit-time labels (columns)</span>
          <CsvInput label="Transit-time labels" placeholder="e.g. food, all other labels" value={labels} onChange={(l) => onChange(fit({ ...value, transitTimeLabels: l }))} />
        </div>
      </div>
      {rowKeys.length > 0 && (
        <table className="text-sm">
          <thead>
            <tr>
              <th />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="text-muted-foreground p-1 text-left text-xs font-normal">
                  {groups.length && labels.length ? labels[c] : "Transit days (min–max)"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(value.rows ?? []).map((row, r) => (
              <tr key={r} className="border-t">
                <td className="p-1 text-xs">{regions.find((x) => x.id === rowKeys[r])?.label ?? rowKeys[r]}</td>
                {(row.values ?? []).map((v, c) => (
                  <td key={c} className="p-1">
                    <div className="flex items-center gap-1">
                      <NumInput label="Min transit days" className="w-16" value={v.minTransitDays} onChange={(n) => onChange({ ...value, rows: setAt(value.rows, r, { values: setAt(row.values, c, { ...v, minTransitDays: n }) }) })} />
                      –
                      <NumInput label="Max transit days" className="w-16" value={v.maxTransitDays} onChange={(n) => onChange({ ...value, rows: setAt(value.rows, r, { values: setAt(row.values, c, { ...v, maxTransitDays: n }) }) })} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
