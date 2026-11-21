"use client";

import { useFilterTransition } from "@/components/dashboard/filter-pending";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** A dropdown bound to one URL search param, so the server component re-renders with the new value. */
export function SearchParamSelect({
  param,
  value,
  items,
  label,
}: {
  param: string;
  value: string;
  /** `set` / `clear` change other params along with this one, e.g. Hourly also narrowing the date range */
  items: { value: string; label: string; disabled?: boolean; set?: Record<string, string>; clear?: string[] }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useFilterTransition();

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        const sp = new URLSearchParams(params);
        const item = items.find((i) => i.value === next);
        for (const k of item?.clear ?? []) sp.delete(k);
        for (const [k, v] of Object.entries(item?.set ?? {})) sp.set(k, v);
        sp.set(param, next);
        startTransition(() => router.replace(`${pathname}?${sp}`, { scroll: false }));
      }}
    >
      <SelectTrigger size="sm" aria-label={label} data-pending={pending || undefined} className="min-w-36 data-pending:opacity-70">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value} disabled={i.disabled}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
