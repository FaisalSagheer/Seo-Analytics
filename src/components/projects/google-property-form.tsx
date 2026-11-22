"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { listGoogleProperties, registerMerchantCenter } from "@/lib/actions/settings";
import { useCan } from "@/components/permissions-provider";
import { Input } from "@/components/ui/input";
import { updateProjectGoogle } from "@/lib/actions/projects";
import type { ProjectGoogleInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type Options = { sites: string[]; properties: { id: string; name: string }[]; merchants: { id: string; name: string }[]; merchantError?: string; merchantErrorKind?: string };

export function GooglePropertyForm({
  connected,
  initial,
}: {
  connected: boolean;
  initial: ProjectGoogleInput;
}) {
  const [draft, setDraft] = useState<ProjectGoogleInput>(initial);
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canRegister = useCan("google.edit");
  const [registering, startRegister] = useTransition();
  const [reloads, setReloads] = useState(0);

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
  }, [connected, initial.projectId, reloads]);

  function register() {
    startRegister(async () => {
      const res = await registerMerchantCenter(initial.projectId, draft.merchantId ?? undefined);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.saved ? "Registered with Merchant Center and saved the account." : "Registered with Merchant Center.");
      // Google can take a minute to recognise the registration; ask for the account list again
      setReloads((n) => n + 1);
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProjectGoogle(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Google properties saved. Sync to pull data.");
    });
  }

  const siteItems = [{ value: "", label: "None" }, ...(options?.sites ?? []).map((s) => ({ value: s, label: s }))];
  const merchantItems = [
    { value: "", label: "None" },
    ...(options?.merchants ?? []).map((m) => ({ value: m.id, label: m.name === m.id ? m.id : `${m.name} (${m.id})` })),
    // Keep a saved account selectable even if this access can't list it right now
    ...(draft.merchantId && !(options?.merchants ?? []).some((m) => m.id === draft.merchantId) ? [{ value: draft.merchantId, label: draft.merchantId }] : []),
  ];
  const propItems = [{ value: "", label: "None" }, ...(options?.properties ?? []).map((p) => ({ value: p.id, label: p.name }))];

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>Google properties</CardTitle>
          <CardDescription>Pick which Search Console site, GA4 property and Merchant Center account feed this project&apos;s reports.</CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          {!connected ? (
            <p className="text-muted-foreground text-sm">
              No Google account with Search Console and Analytics access is linked yet.{" "}
              <Link href="#google-connection" className="text-foreground underline underline-offset-4">
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
              <Field>
                <FieldLabel>Merchant Center account</FieldLabel>
                {options.merchants.length > 0 ? (
                  <Select items={merchantItems} value={draft.merchantId ?? ""} onValueChange={(v) => setDraft({ ...draft, merchantId: v || null })}>
                    <SelectTrigger className="w-full" aria-label="Merchant Center account">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {merchantItems.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  // Google can't list the accounts yet (often until the app is registered), so take the ID directly
                  <div className="flex gap-2">
                    <Input
                      aria-label="Merchant Center ID"
                      inputMode="numeric"
                      placeholder="Merchant Center ID, e.g. 123456789"
                      value={draft.merchantId ?? ""}
                      onChange={(e) => setDraft({ ...draft, merchantId: e.target.value.replace(/\D/g, "") || null })}
                    />
                    {options.merchantErrorKind === "registration" && canRegister && (
                      <Button type="button" variant="outline" disabled={registering || !draft.merchantId} onClick={register}>
                        {registering && <Spinner data-icon="inline-start" />}
                        Register
                      </Button>
                    )}
                  </div>
                )}
                {options.merchantError ? (
                  <p role="alert" className="text-destructive text-sm">
                    {options.merchantErrorKind === "registration"
                      ? "Google asks for this app to be registered with the Merchant Center account once. Enter the account's ID (shown at the top of Merchant Center) and click Register. It needs Admin access to that account."
                      : options.merchantError}
                  </p>
                ) : options.merchants.length === 0 ? (
                  <FieldDescription>
                    Google lists no Merchant Center accounts for this project&apos;s Google access. Add it as a user in Merchant Center (Settings → People and access).
                  </FieldDescription>
                ) : (
                  <FieldDescription>For the Shopping page.</FieldDescription>
                )}
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
