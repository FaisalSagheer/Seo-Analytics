"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { removeBing, saveBing } from "@/lib/actions/settings";
import type { BingCredentialInput } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function BingCard({ connected, envFallback }: { connected: boolean; envFallback: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<BingCredentialInput>({ apiKey: "" });
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveBing(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Bing connected · ${res.data.sites} verified site${res.data.sites === 1 ? "" : "s"}`);
      setDraft({ apiKey: "" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeBing();
      if (!res.ok) return void toast.error(res.error);
      toast.success("Bing disconnected");
      router.refresh();
    });
  }

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>Bing Webmaster Tools (backlinks, free)</CardTitle>
          <CardDescription>
            Free inbound-link data for sites you&apos;ve verified in{" "}
            <a href="https://www.bing.com/webmasters" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Bing Webmaster Tools
            </a>
            . Get the key under Settings → API access → API key. Bing reports the linking page and anchor text only, with no domain
            rank, link type or dates. Used for backlinks when DataForSEO&apos;s Backlinks API isn&apos;t available.
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
              <FieldLabel htmlFor="bing-key">API key</FieldLabel>
              <Input
                id="bing-key"
                type="password"
                autoComplete="off"
                placeholder={connected ? "Saved, enter a new one to replace it" : ""}
                value={draft.apiKey}
                onChange={(e) => setDraft({ apiKey: e.target.value })}
              />
              <FieldDescription>Checked by listing your verified sites (free), then stored encrypted.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={pending || !draft.apiKey}>
            {pending && <Spinner data-icon="inline-start" />}
            {connected ? "Replace key" : "Connect"}
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
