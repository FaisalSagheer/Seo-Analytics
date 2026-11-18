"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRESET_LABEL, addDays, compareAvailable, type CompareKind } from "@/lib/date-range";

export type DateRangeState = {
  /** Preset length in days (ignored while `from`/`to` are set) */
  days: number;
  from?: string;
  to?: string;
  compare: { kind: CompareKind; from?: string; to?: string };
};

type Props = DateRangeState & {
  presets: readonly number[];
  allowCustom: boolean;
  allowCompare: boolean;
  /** Earliest and latest selectable day, YYYY-MM-DD */
  minDate: string;
  maxDate: string;
};

/** Why a custom start/end pair can't be applied, or null when it can. */
function dateError(from: string, to: string, min: string, max: string): string | null {
  if (!from || !to) return "Pick a start and an end date.";
  if (from < min || to < min) return `Date can't be before ${min}`;
  if (from > max || to > max) return `Date can't be after ${max}`;
  if (from > to) return "The start date must be before the end date.";
  return null;
}

function Radio({ name, checked, onChange, disabled = false, children }: { name: string; checked: boolean; onChange: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex items-center gap-3 py-2 text-sm ${disabled ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}`}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="accent-primary size-4" />
      {children}
    </label>
  );
}

function DateFields({ from, to, onFrom, onTo, min, max, error }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; min: string; max: string; error: string | null }) {
  return (
    <div className="flex flex-col gap-1 pb-2 pl-7">
      <div className="flex items-center gap-2">
        <Input type="date" aria-label="Start date" value={from} min={min} max={max} onChange={(e) => onFrom(e.target.value)} className="w-40" />
        <span className="text-muted-foreground">–</span>
        <Input type="date" aria-label="End date" value={to} min={min} max={max} onChange={(e) => onTo(e.target.value)} className="w-40" />
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

/** Search Console-style date range dialog: a Filter tab for the range and a Compare tab for the period to compare it with. */
export function DateRangeDialog({ days, from, to, compare, presets, allowCustom, allowCompare, minDate, maxDate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const isCustom = Boolean(from && to);
  const [mode, setMode] = useState<"preset" | "custom">(isCustom ? "custom" : "preset");
  const [preset, setPreset] = useState(days);
  const [start, setStart] = useState(from ?? "");
  const [end, setEnd] = useState(to ?? "");
  const [cmp, setCmp] = useState<CompareKind>(compare.kind);
  const [cStart, setCStart] = useState(compare.from ?? "");
  const [cEnd, setCEnd] = useState(compare.to ?? "");

  const rangeError = mode === "custom" ? dateError(start, end, minDate, maxDate) : null;
  const compareError = cmp === "custom" ? dateError(cStart, cEnd, minDate, maxDate) : null;
  // The draft range, to tell which comparisons would reach back beyond the data Google keeps
  const draftEnd = new Date(`${mode === "custom" && end ? end : maxDate}T00:00:00Z`);
  const draftStart = mode === "custom" && start ? new Date(`${start}T00:00:00Z`) : addDays(draftEnd, -(preset - 1));
  const draft = { start: draftStart, end: draftEnd };
  const can = (kind: CompareKind) => compareAvailable(kind, draft);
  const canApply = !rangeError && !compareError;

  const label = isCustom ? `${from} – ${to}` : (PRESET_LABEL[days] ?? `Last ${days} days`);
  const base = mode === "preset" ? (PRESET_LABEL[preset] ?? "").toLowerCase() : "this range";

  function reset() {
    setMode(isCustom ? "custom" : "preset");
    setPreset(days);
    setStart(from ?? "");
    setEnd(to ?? "");
    setCmp(compare.kind);
    setCStart(compare.from ?? "");
    setCEnd(compare.to ?? "");
  }

  function apply() {
    const sp = new URLSearchParams(params);
    for (const k of ["days", "from", "to", "compare", "cfrom", "cto"]) sp.delete(k);
    if (mode === "custom") {
      sp.set("from", start);
      sp.set("to", end);
    } else {
      sp.set("days", String(preset));
    }
    // Week over week only means something for a 24 hour range
    const kind = cmp === "week" && !(mode === "preset" && preset === 1) ? "none" : cmp;
    if (kind !== "none") sp.set("compare", kind);
    if (kind === "custom") {
      sp.set("cfrom", cStart);
      sp.set("cto", cEnd);
    }
    setOpen(false);
    startTransition(() => router.replace(`${pathname}?${sp}`, { scroll: false }));
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        data-pending={pending || undefined}
        className="data-pending:opacity-70"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <CalendarIcon data-icon="inline-start" />
        {label}
        {compare.kind !== "none" && <span className="text-muted-foreground">· compared</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Date range</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="filter">
            <TabsList>
              <TabsTrigger value="filter">Filter</TabsTrigger>
              {allowCompare && <TabsTrigger value="compare">Compare</TabsTrigger>}
            </TabsList>
            <TabsContent value="filter" className="pt-2">
              {presets.map((p) => (
                <Radio key={p} name="range" checked={mode === "preset" && preset === p} onChange={() => {
                    setMode("preset");
                    setPreset(p);
                    // A comparison the new range can't have falls back to none
                    if (cmp !== "none" && cmp !== "custom" && !compareAvailable(cmp, { start: addDays(new Date(`${maxDate}T00:00:00Z`), -(p - 1)), end: new Date(`${maxDate}T00:00:00Z`) })) setCmp("none");
                  }}>
                  {PRESET_LABEL[p]}
                </Radio>
              ))}
              {allowCustom && (
                <>
                  <Radio name="range" checked={mode === "custom"} onChange={() => setMode("custom")}>
                    Custom
                  </Radio>
                  {mode === "custom" && <DateFields from={start} to={end} onFrom={setStart} onTo={setEnd} min={minDate} max={maxDate} error={rangeError} />}
                </>
              )}
            </TabsContent>
            {allowCompare && (
              <TabsContent value="compare" className="pt-2">
                <Radio name="compare" checked={cmp === "none"} onChange={() => setCmp("none")}>
                  No comparison
                </Radio>
                <Radio name="compare" checked={cmp === "previous"} disabled={!can("previous")} onChange={() => setCmp("previous")}>
                  Compare {base} to previous period
                </Radio>
                {mode === "preset" && preset === 1 && (
                  <Radio name="compare" checked={cmp === "week"} onChange={() => setCmp("week")}>
                    Compare last 24 hours week over week
                  </Radio>
                )}
                <Radio name="compare" checked={cmp === "year"} disabled={!can("year")} onChange={() => setCmp("year")}>
                  Compare {base} year over year
                </Radio>
                <Radio name="compare" checked={cmp === "custom"} onChange={() => setCmp("custom")}>
                  Custom
                </Radio>
                {(!can("previous") || !can("year")) && <p className="text-muted-foreground pl-7 text-xs">Greyed-out comparisons would reach back past the 16 months Google keeps.</p>}
                {cmp === "custom" && <DateFields from={cStart} to={cEnd} onFrom={setCStart} onTo={setCEnd} min={minDate} max={maxDate} error={compareError} />}
              </TabsContent>
            )}
          </Tabs>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!canApply} onClick={apply}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
