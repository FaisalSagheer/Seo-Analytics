"use client";

import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, LOCATIONS } from "@/lib/markets";
import type { ProjectInput } from "@/lib/validations";

const locationItems = LOCATIONS.map((l) => ({ value: String(l.code), label: l.label }));
const languageItems = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));
const deviceItems = [
  { value: "DESKTOP", label: "Desktop" },
  { value: "MOBILE", label: "Mobile" },
];

/** Shared by the create dialog and project settings so the two forms can't drift. */
export function ProjectFields({ draft, onChange }: { draft: ProjectInput; onChange: (d: ProjectInput) => void }) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="p-name">Name</FieldLabel>
        <Input id="p-name" required value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="p-domain">Domain</FieldLabel>
        <Input
          id="p-domain"
          required
          placeholder="example.com"
          value={draft.domain}
          onChange={(e) => onChange({ ...draft, domain: e.target.value })}
        />
        <FieldDescription>Subdomains count as matches, so example.com also tracks blog.example.com.</FieldDescription>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel>Location</FieldLabel>
          <Select
            items={locationItems}
            value={String(draft.locationCode ?? 2840)}
            onValueChange={(v) => v && onChange({ ...draft, locationCode: Number(v) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {locationItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Language</FieldLabel>
          <Select
            items={languageItems}
            value={draft.languageCode ?? "en"}
            onValueChange={(v) => v && onChange({ ...draft, languageCode: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {languageItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Device</FieldLabel>
          <Select
            items={deviceItems}
            value={draft.device ?? "DESKTOP"}
            onValueChange={(v) => v && onChange({ ...draft, device: v as "DESKTOP" | "MOBILE" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {deviceItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </FieldGroup>
  );
}
