"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * A single-choice toggle bound to one URL search param, so the server
 * component re-renders with the new value and the view is linkable.
 */
export function SearchParamToggle({
  param,
  value,
  options,
  label,
}: {
  param: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[value]}
      aria-label={label}
      data-pending={pending || undefined}
      className="data-pending:opacity-70"
      onValueChange={(v) => {
        const next = v[0];
        if (!next) return;
        const sp = new URLSearchParams(params);
        sp.set(param, next);
        // Transition keeps the current data on screen while the server renders
        startTransition(() => router.replace(`${pathname}?${sp}`, { scroll: false }));
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
