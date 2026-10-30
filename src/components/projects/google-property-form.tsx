"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listGoogleProperties } from "@/lib/actions/settings";
import { updateProjectGoogle } from "@/lib/actions/projects";
import type { ProjectGoogleInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type Options = { sites: string[]; properties: { id: string; name: string }[] };

export function GooglePropertyForm({
  connected,
  initial,
}: {
  connected: boolean;
  initial: ProjectGoogleInput;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectGoogleInput>(initial);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // Property lists live in the project owner's Google account, so this one fetch is client-driven
    if (!connected) return;
    let cancelled = false;
    listGoogleProperties(initial.projectId).then((res) => {
      if (cancelled) return;
      if (res.ok) setOptions(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, initial.projectId]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProjectGoogle(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Google properties saved. Sync to pull data.");
      router.refresh();
    });
  }

  const siteItems = [{ value: "", label: "None" }, ...(options?.sites ?? []).map((s) => ({ value: s, label: s }))];
  const propItems = [{ value: "", label: "None" }, ...(options?.properties ?? []).map((p) => ({ value: p.id, label: p.name }))];

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>Search Console and GA4</CardTitle>
          <CardDescription>Pick which properties feed this project&apos;s performance reports.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {!connected ? (
            <p className="text-muted-foreground text-sm">
              No Google account with Search Console and Analytics access is linked yet.{" "}
              <Link href="/settings" className="text-foreground underline underline-offset-4">
                Connect Google
              </Link>{" "}
              first.
            </p>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : !options ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel>Search Console property</FieldLabel>
                <Select items={siteItems} value={draft.gscSiteUrl ?? ""} onValueChange={(v) => setDraft({ ...draft, gscSiteUrl: v || null })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {siteItems.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>Domain properties appear as sc-domain:example.com.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>GA4 property</FieldLabel>
                <Select items={propItems} value={draft.ga4PropertyId ?? ""} onValueChange={(v) => setDraft({ ...draft, ga4PropertyId: v || null })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {propItems.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>Only organic-search sessions are pulled, so they line up with rankings.</FieldDescription>
              </Field>
            </FieldGroup>
          )}
        </CardContent>
        {connected && options && (
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
