"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { removeDataForSeo, saveDataForSeo } from "@/lib/actions/settings";
import type { ProviderCredentialInput } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function DataForSeoCard({ login, envFallback }: { login: string | null; envFallback: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProviderCredentialInput>({ login: login ?? "", password: "" });
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveDataForSeo(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("DataForSEO connected");
      setDraft({ ...draft, password: "" });
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeDataForSeo();
      if (!res.ok) return void toast.error(res.error);
      toast.success("DataForSEO disconnected");
      setDraft({ login: "", password: "" });
      router.refresh();
    });
  }

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader>
          <CardTitle>DataForSEO</CardTitle>
          <CardDescription>
            Powers keyword ideas, domain overview and backlinks, and rank checks when Serper isn&apos;t connected. Use the API login
            and password from your{" "}
            <a href="https://app.dataforseo.com/api-access" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              DataForSEO API access page
            </a>
            , not your account password.
          </CardDescription>
          <CardAction>
            {login ? (
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
              <FieldLabel htmlFor="dfs-login">API login</FieldLabel>
              <Input id="dfs-login" autoComplete="off" value={draft.login} onChange={(e) => setDraft({ ...draft, login: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dfs-password">API password</FieldLabel>
              <Input
                id="dfs-password"
                type="password"
                autoComplete="new-password"
                placeholder={login ? "Saved, enter a new one to replace it" : ""}
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
              <FieldDescription>Verified with one cheap API call, then stored encrypted (AES-256-GCM).</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit" disabled={pending || !draft.login || !draft.password}>
            {pending && <Spinner data-icon="inline-start" />}
            {login ? "Update" : "Connect"}
          </Button>
          {login && (
            <Button type="button" variant="ghost" disabled={pending} onClick={remove}>
              Disconnect
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
