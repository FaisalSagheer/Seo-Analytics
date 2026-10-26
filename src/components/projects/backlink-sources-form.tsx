"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listBingProperties } from "@/lib/actions/settings";
import { updateProjectBacklinkSources } from "@/lib/actions/projects";
import type { ProjectBacklinkSourcesInput } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

/**
 * Per-project backlink sources: which ones a refresh fetches (the Backlinks
 * page can switch between whatever was fetched) and which Bing site to read.
 */
export function BacklinkSourcesForm({
  isDemo,
  dataForSeoConnected,
  bingConnected,
  initial,
}: {
  isDemo: boolean;
  dataForSeoConnected: boolean;
  bingConnected: boolean;
  initial: ProjectBacklinkSourcesInput;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectBacklinkSourcesInput>(initial);
  const [sites, setSites] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const showBingSite = bingConnected && !isDemo && draft.backlinksBing;

  useEffect(() => {
    if (!showBingSite || sites) return;
    let cancelled = false;
    listBingProperties().then((res) => {
      if (cancelled) return;
      if (res.ok) setSites(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [showBingSite, sites]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProjectBacklinkSources(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Backlink sources saved. Refresh backlinks to apply.");
      router.refresh();
    });
  }

  const items = [{ value: "", label: "Match automatically by domain" }, ...(sites ?? []).map((s) => ({ value: s, label: s }))];

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>Backlink sources</CardTitle>
          <CardDescription>
            Each refresh fetches backlinks from every source switched on here and keeps them separately. The Backlinks page can
            switch between them.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6">
          <FieldGroup>
            <Field orientation="horizontal">
              <Checkbox
                id="src-dfs"
                checked={draft.backlinksDataForSeo}
                onCheckedChange={(c) => setDraft({ ...draft, backlinksDataForSeo: Boolean(c) })}
              />
              <FieldContent>
                <FieldLabel htmlFor="src-dfs">
                  DataForSEO
                  <SourceStatus connected={isDemo || dataForSeoConnected} />
                </FieldLabel>
                <FieldDescription>
                  Detailed: domain rank, dofollow/nofollow, first/last seen, new/lost. Needs DataForSEO&apos;s Backlinks
                  subscription and costs credits on each refresh.
                </FieldDescription>
              </FieldContent>
            </Field>
            <Field orientation="horizontal">
              <Checkbox
                id="src-bing"
                checked={draft.backlinksBing}
                onCheckedChange={(c) => setDraft({ ...draft, backlinksBing: Boolean(c) })}
              />
              <FieldContent>
                <FieldLabel htmlFor="src-bing">
                  Bing Webmaster Tools
                  <SourceStatus connected={isDemo || bingConnected} />
                </FieldLabel>
                <FieldDescription>Free, for sites verified in Bing. Linking page and anchor text only.</FieldDescription>
              </FieldContent>
            </Field>

            {!isDemo && draft.backlinksBing && !bingConnected && (
              <p className="text-muted-foreground text-sm">
                <Link href="/settings" className="text-foreground underline underline-offset-4">
                  Add your Bing Webmaster Tools key
                </Link>{" "}
                to use Bing.
              </p>
            )}

            {showBingSite &&
              (error ? (
                <p className="text-destructive text-sm">{error}</p>
              ) : !sites ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Field>
                  <FieldLabel>Bing site</FieldLabel>
                  <Select items={items} value={draft.bingSiteUrl ?? ""} onValueChange={(v) => setDraft({ ...draft, bingSiteUrl: v || null })}>
                    <SelectTrigger className="w-full">
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
                  <FieldDescription>
                    {sites.length === 0
                      ? "No verified sites on this key yet. Verify the site in Bing Webmaster Tools first."
                      : "Bing only reports links for sites you've verified."}
                  </FieldDescription>
                </Field>
              ))}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SourceStatus({ connected }: { connected: boolean }) {
  return (
    <Badge variant={connected ? "secondary" : "outline"} className="ml-2">
      {connected ? "Connected" : "Not connected"}
    </Badge>
  );
}
