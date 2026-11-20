"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fromMicros, toMicros, type BusinessDays, type Price } from "@/lib/merchant-shipping";
import { cn } from "@/lib/utils";

/** A dropdown over plain string options. */
export function Pick<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <Select items={options as { value: string; label: string }[]} value={value as string} onValueChange={(v) => v && onChange(v as T)}>
      <SelectTrigger aria-label={label} className={cn("w-full", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** A whole-number input; empty means "not set". */
export function NumInput({ value, onChange, label, min = 0, className }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; min?: number; className?: string }) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      className={className}
      value={value ?? ""}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d-]/g, "");
        onChange(t === "" || t === "-" ? undefined : Math.max(min, Number(t)));
      }}
    />
  );
}

/** A list typed as comma-separated text, kept as typed until the field loses focus. */
export function CsvInput({
  value,
  onChange,
  label,
  placeholder,
  upper,
}: {
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  label: string;
  placeholder?: string;
  upper?: boolean;
}) {
  const joined = (value ?? []).join(", ");
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (t: string) => t.split(",").map((s) => (upper ? s.trim().toUpperCase() : s.trim())).filter(Boolean);
  return (
    <Input
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? joined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** An amount in the given currency, stored as micros; empty clears it. Typing is kept as typed until blur. */
export function MoneyInput({
  value,
  onChange,
  currency,
  label,
  allowNegative,
}: {
  value: Price | undefined;
  onChange: (v: Price | undefined) => void;
  currency: string | undefined;
  label: string;
  allowNegative?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? fromMicros(value?.amountMicros);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        aria-label={label}
        inputMode="decimal"
        value={shown}
        onChange={(e) => {
          const t = e.target.value.replace(allowNegative ? /[^\d.-]/g : /[^\d.]/g, "");
          setDraft(t);
          const micros = toMicros(t);
          onChange(t === "" ? undefined : micros ? { amountMicros: micros, currencyCode: currency } : value);
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="text-muted-foreground w-10 shrink-0 text-xs">{currency || "—"}</span>
    </div>
  );
}

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

/** Business days; `undefined` means Google's default (Monday to Friday). */
export function DaysPicker({ value, onChange, label }: { value: BusinessDays | undefined; onChange: (v: BusinessDays | undefined) => void; label: string }) {
  const days = value?.businessDays;
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={days == null} onCheckedChange={(c) => onChange(c === true ? undefined : { businessDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] })} />
        Monday to Friday (Google&apos;s default)
      </label>
      {days != null && (
        <div className="flex flex-wrap gap-3">
          {DAYS.map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                aria-label={d}
                checked={days.includes(d)}
                onCheckedChange={(c) => onChange({ businessDays: c === true ? DAYS.filter((x) => x === d || days.includes(x)) : days.filter((x) => x !== d) })}
              />
              {d.charAt(0) + d.slice(1, 3).toLowerCase()}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** A labelled field, compact. */
export function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  );
}

/** Replaces item `i` of a list. */
export const setAt = <T,>(list: T[] | undefined, i: number, item: T): T[] => (list ?? []).map((x, k) => (k === i ? item : x));
/** Removes item `i` of a list. */
export const dropAt = <T,>(list: T[] | undefined, i: number): T[] => (list ?? []).filter((_, k) => k !== i);
