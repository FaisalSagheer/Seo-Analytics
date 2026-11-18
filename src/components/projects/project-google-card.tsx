"use client";

import { useRef, useState, useTransition } from "react";
import { CopyIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { removeProjectGoogle, saveProjectGoogle } from "@/lib/actions/project-google";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type GoogleAccessSource = "project" | "owner" | "none";

const SOURCE_LABEL: Record<GoogleAccessSource, string> = {
  project: "This project's service account",
  owner: "Owner's Google connection",
  none: "Not connected",
};

/**
 * Where this project's Search Console and GA4 data comes from. A client can
 * hand over a service account key, so no Google sign-in is needed; without one
 * the project uses its owner's Google connection from Settings.
 */
export function ProjectGoogleCard({ projectId, source, email }: { projectId: string; source: GoogleAccessSource; email: string | null }) {
  const [pending, startTransition] = useTransition();
  const [keyJson, setKeyJson] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const own = source === "project";

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 20_000) return void toast.error("That file is too large to be a service account key.");
    setKeyJson(await file.text());
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProjectGoogle({ projectId, keyJson });
      if (!res.ok) return void toast.error(res.error);
      setKeyJson("");
      if (fileRef.current) fileRef.current.value = "";
      const { sites, properties } = res.data;
      if (sites === 0 && properties === 0) {
        toast.warning(`Key saved, but ${res.data.email} can't see any Search Console site or GA4 property yet. Add it as a user in both.`);
      } else {
        toast.success(`Service account verified · sees ${sites} Search Console site${sites === 1 ? "" : "s"} and ${properties} GA4 propert${properties === 1 ? "y" : "ies"}`);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeProjectGoogle(projectId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Service account removed from this project");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google access</CardTitle>
        <CardDescription>
          Search Console (rankings, clicks, queries) and GA4 (organic traffic) are read with a Google service account, so the client never has
          to sign in. Without one, this project falls back to its owner&apos;s Google connection in Settings. The key is stored encrypted and
          never shown again.
        </CardDescription>
        <div className="pt-1">
          <Badge variant={own ? "secondary" : "outline"}>{SOURCE_LABEL[source]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 py-6">
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
          <li>In Google Cloud, create a service account and download a JSON key for it. Enable the Search Console, Analytics Data and Analytics Admin APIs there.</li>
          <li>In Search Console → Settings → Users and permissions, add the service account&apos;s email as a user (Restricted is enough).</li>
          <li>In GA4 → Admin → Property access management, add the same email with the Viewer role.</li>
          <li>Paste the JSON key below.</li>
        </ol>

        {own && email && (
          <Field>
            <FieldLabel htmlFor="sa-email">Service account email</FieldLabel>
            <div className="flex gap-2">
              <Input id="sa-email" readOnly value={email} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy email"
                onClick={() => navigator.clipboard.writeText(email).then(() => toast.success("Email copied"))}
              >
                <CopyIcon />
              </Button>
            </div>
            <FieldDescription>Add this address in Search Console and GA4 for the client&apos;s site and property.</FieldDescription>
          </Field>
        )}

        <form onSubmit={save}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="sa-key">{own ? "Replace the JSON key" : "Service account JSON key"}</FieldLabel>
              <Textarea
                id="sa-key"
                rows={6}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-xs"
                placeholder={own ? "Saved. Paste a new key file to replace it." : '{ "type": "service_account", "client_email": "...", "private_key": "..." }'}
                value={keyJson}
                onChange={(e) => setKeyJson(e.target.value)}
              />
              <FieldDescription>Checked by signing in to Google and listing what the account can see, then stored encrypted.</FieldDescription>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={pending || !keyJson.trim()}>
                {pending && <Spinner data-icon="inline-start" />}
                {own ? "Replace key" : "Add key"}
              </Button>
              <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                Choose .json file
              </Button>
              <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} onChange={(e) => loadFile(e.target.files?.[0])} />
              {own && email && (
                <ConfirmDelete
                  triggerRender={<Button type="button" variant="ghost" disabled={pending} />}
                  title="Remove this project's Google key?"
                  description="The stored key is deleted. This project goes back to its owner's Google connection, or loses Google data if there is none."
                  details={[{ label: "Service account", value: email }]}
                  note="Data already synced is kept."
                  confirmLabel="Remove key"
                  onConfirm={remove}
                >
                  Remove key
                </ConfirmDelete>
              )}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
