"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { removeSerper, saveSerper } from "@/lib/actions/settings";
import type { SerperCredentialInput } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const DEPTHS = [10, 20, 30, 50, 100].map((d) => ({
  value: String(d),
  label: `Top ${d} · up to ${d / 10} credit${d === 10 ? "" : "s"} per keyword`,
}));

export function SerperCard({ connected, rankDepth, envFallback }: { connected: boolean; rankDepth: number; envFallback: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SerperCredentialInput>({ apiKey: "", rankDepth });
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveSerper(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(draft.apiKey ? "Serper connected" : "Check depth saved");
      setDraft({ ...draft, apiKey: "" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeSerper();
      if (!res.ok) return void toast.error(res.error);
      toast.success("Serper disconnected");
      router.refresh();
    });
  }

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>Serper (rank checks)</CardTitle>
          <CardDescription>
            A cheaper way to check Google rankings, with 2,500 free queries to start. Get a key at{" "}
            <a href="https://serper.dev" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              serper.dev
            </a>
            . When connected, rank checks use Serper instead of DataForSEO. Keyword ideas, domain and backlink data still need
            DataForSEO. Serper returns desktop results only.
          </CardDescription>
          <CardAction>
            {connected ? (
              <Badge variant="secondary">
                <CheckCircle2Icon data-icon="inline-start" />
                Connected
              </Badge>
            ) : envFallback ? (
              <Badge variant="outline">Using server key</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="py-6">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="serper-key">API key</FieldLabel>
              <Input
                id="serper-key"
                type="password"
                autoComplete="off"
                placeholder={connected ? "Saved, enter a new one to replace it" : ""}
                value={draft.apiKey}
                onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              />
              <FieldDescription>Checked with one search (1 credit), then stored encrypted.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Check depth</FieldLabel>
              <Select items={DEPTHS} value={String(draft.rankDepth)} onValueChange={(v) => v && setDraft({ ...draft, rankDepth: Number(v) })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {DEPTHS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                Google shows 10 results per page and each page costs a credit. A check stops at the page where your site appears,
                so only keywords you don&apos;t rank for use the full depth.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={pending || (!connected && !draft.apiKey)}>
            {pending && <Spinner data-icon="inline-start" />}
            {connected ? "Save" : "Connect"}
          </Button>
          {connected && (
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              Disconnect
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
