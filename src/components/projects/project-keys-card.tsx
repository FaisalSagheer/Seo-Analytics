"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeProjectKey, saveProjectBing, saveProjectDataForSeo, saveProjectSerper } from "@/lib/actions/project-keys";
import type { CredentialSource, CredentialSummary } from "@/lib/providers/credentials";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

const DEPTHS = [10, 20, 30, 50, 100].map((d) => ({
  value: String(d),
  label: `Top ${d} · up to ${d / 10} credit${d === 10 ? "" : "s"} per keyword`,
}));

const SOURCE_LABEL: Record<CredentialSource, string> = {
  project: "This project's key",
  owner: "Owner's key from Settings",
  server: "Server key",
  none: "Not set",
};

type Provider = "SERPER" | "DATAFORSEO" | "BING";

export type ProjectKeysSummary = Record<Provider, CredentialSummary>;

/**
 * Keys for this project alone, typically the client's own. A project's key is
 * used before its owner's account key (Settings → Providers), which is used
 * before the server-wide key.
 */
export function ProjectKeysCard({ projectId, summary }: { projectId: string; summary: ProjectKeysSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider keys</CardTitle>
        <CardDescription>
          Keys added here are used for this project only, so a client&apos;s usage is billed to their own account. Without one, the project
          falls back to its owner&apos;s keys from Settings → Providers, then the server&apos;s. Keys are stored encrypted and never shown again.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8 py-6">
        <SerperSection projectId={projectId} summary={summary.SERPER} />
        <DataForSeoSection projectId={projectId} summary={summary.DATAFORSEO} />
        <BingSection projectId={projectId} summary={summary.BING} />
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: CredentialSource }) {
  return <Badge variant={source === "project" ? "secondary" : "outline"}>{SOURCE_LABEL[source]}</Badge>;
}

function Section({ title, hint, source, children }: { title: string; hint: string; source: CredentialSource; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        <SourceBadge source={source} />
      </div>
      {children}
    </section>
  );
}

function RemoveKey({ projectId, provider, label, effect, details }: { projectId: string; provider: Provider; label: string; effect: string; details?: { label: string; value: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDelete
      triggerRender={<Button type="button" variant="ghost" disabled={pending} />}
      title={`Remove this project's ${label} key?`}
      description={`The stored key is deleted. ${effect}`}
      details={details}
      note="Data already synced is kept."
      confirmLabel="Remove key"
      onConfirm={() =>
        startTransition(async () => {
          const res = await removeProjectKey(projectId, provider);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`${label} key removed from this project`);
          router.refresh();
        })
      }
    >
      Remove key
    </ConfirmDelete>
  );
}

function SerperSection({ projectId, summary }: { projectId: string; summary: CredentialSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const own = summary.source === "project";
  const [draft, setDraft] = useState({ apiKey: "", rankDepth: summary.rankDepth ?? 50 });

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProjectSerper({ projectId, ...draft });
      if (!res.ok) return void toast.error(res.error);
      toast.success(draft.apiKey ? "Serper key saved for this project" : "Check depth saved");
      setDraft({ ...draft, apiKey: "" });
      router.refresh();
    });
  }

  return (
    <Section title="Serper (rank checks)" hint="Live Google rank checks. Without a key, rankings come from Search Console." source={summary.source}>
      <form onSubmit={save}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pk-serper-key">API key</FieldLabel>
            <Input
              id="pk-serper-key"
              type="password"
              autoComplete="off"
              placeholder={own ? "Saved, enter a new one to replace it" : ""}
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
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || (!own && !draft.apiKey)}>
              {pending && <Spinner data-icon="inline-start" />}
              {own ? "Save" : "Add key"}
            </Button>
            {own && (
              <RemoveKey
                projectId={projectId}
                provider="SERPER"
                label="Serper"
                effect="Rank checks for this project fall back to the owner's or the server's key, or to Search Console."
                details={[{ label: "Check depth", value: `Top ${summary.rankDepth ?? 50}` }]}
              />
            )}
          </div>
        </FieldGroup>
      </form>
    </Section>
  );
}

function DataForSeoSection({ projectId, summary }: { projectId: string; summary: CredentialSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const own = summary.source === "project";
  const [draft, setDraft] = useState({ login: summary.login ?? "", password: "" });

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProjectDataForSeo({ projectId, ...draft });
      if (!res.ok) return void toast.error(res.error);
      toast.success("DataForSEO key saved for this project");
      setDraft({ ...draft, password: "" });
      router.refresh();
    });
  }

  return (
    <Section title="DataForSEO" hint="Keyword ideas, domain overview, top pages and backlinks." source={summary.source}>
      <form onSubmit={save}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pk-dfs-login">API login</FieldLabel>
            <Input id="pk-dfs-login" autoComplete="off" value={draft.login} onChange={(e) => setDraft({ ...draft, login: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="pk-dfs-password">API password</FieldLabel>
            <Input
              id="pk-dfs-password"
              type="password"
              autoComplete="off"
              placeholder={own ? "Saved, enter a new one to replace it" : ""}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <FieldDescription>The API credentials from your DataForSEO API access page, not your account password. Verified with one cheap call.</FieldDescription>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !draft.login || !draft.password}>
              {pending && <Spinner data-icon="inline-start" />}
              {own ? "Update" : "Add key"}
            </Button>
            {own && (
              <RemoveKey
                projectId={projectId}
                provider="DATAFORSEO"
                label="DataForSEO"
                effect="Keyword ideas, domain overview and DataForSEO backlinks for this project use the owner's or the server's key instead."
                details={[{ label: "Login", value: summary.login ?? "" }]}
              />
            )}
          </div>
        </FieldGroup>
      </form>
    </Section>
  );
}

function BingSection({ projectId, summary }: { projectId: string; summary: CredentialSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const own = summary.source === "project";
  const [apiKey, setApiKey] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProjectBing({ projectId, apiKey });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Bing key saved for this project · ${res.data.sites} verified site${res.data.sites === 1 ? "" : "s"}`);
      setApiKey("");
      router.refresh();
    });
  }

  return (
    <Section title="Bing Webmaster Tools" hint="Free backlink data for sites verified in the key's Bing account." source={summary.source}>
      <form onSubmit={save}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="pk-bing-key">API key</FieldLabel>
            <Input
              id="pk-bing-key"
              type="password"
              autoComplete="off"
              placeholder={own ? "Saved, enter a new one to replace it" : ""}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <FieldDescription>Bing Webmaster Tools → Settings → API access. Checked by listing verified sites (free).</FieldDescription>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !apiKey}>
              {pending && <Spinner data-icon="inline-start" />}
              {own ? "Replace key" : "Add key"}
            </Button>
            {own && (
              <RemoveKey
                projectId={projectId}
                provider="BING"
                label="Bing"
                effect="Backlinks for this project use the owner's or the server's Bing key instead."
              />
            )}
          </div>
        </FieldGroup>
      </form>
    </Section>
  );
}
