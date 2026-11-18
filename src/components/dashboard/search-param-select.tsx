"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
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
  items: { value: string; label: string; disabled?: boolean }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (!next) return;
        const sp = new URLSearchParams(params);
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
