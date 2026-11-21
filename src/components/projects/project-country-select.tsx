"use client";

import { useFilterTransition } from "@/components/dashboard/filter-pending";
import { toast } from "sonner";
import { setProjectCountry } from "@/lib/actions/projects";
import { useCan } from "@/components/permissions-provider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCATIONS } from "@/lib/markets";

const items = LOCATIONS.map((l) => ({ value: String(l.code), label: l.label }));

/**
 * The project's target country, changeable from the page header. It's the same setting as
 * Project settings → Location, so it applies to everyone; without "Edit project settings" it's shown read-only.
 */
export function ProjectCountrySelect({ projectId, locationCode }: { projectId: string; locationCode: number }) {
  const canEdit = useCan("projects.edit");
  const [pending, startTransition] = useFilterTransition();

  return (
    <Select
      items={items}
      value={String(locationCode)}
      disabled={!canEdit || pending}
      onValueChange={(next) => {
        if (!next || Number(next) === locationCode) return;
        startTransition(async () => {
          const res = await setProjectCountry(projectId, Number(next));
          if (!res.ok) return void toast.error(res.error);
          if (res.data.warning) toast.warning(`Country set to ${res.data.country}. ${res.data.warning}`);
          else toast.success(res.data.synced ? `Country set to ${res.data.country}. Rankings updated.` : `Country set to ${res.data.country}.`);
        });
      }}
    >
      <SelectTrigger size="sm" aria-label="Country" title={canEdit ? undefined : "Only roles that can edit project settings can change this"} data-pending={pending || undefined} className="min-w-40 data-pending:opacity-70">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
