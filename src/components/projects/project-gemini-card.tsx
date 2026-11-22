"use client";

import { useState, useTransition } from "react";
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { removeProjectGemini, saveProjectGemini } from "@/lib/actions/project-gemini";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** This project's Gemini API key: add it once, and it's checked with Google before it's saved. */
export function ProjectGeminiCard({ projectId, hint }: { projectId: string; hint: string | null }) {
  const [pending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveProjectGemini({ projectId, apiKey });
      if (!res.ok) return void toast.error(res.error);
      setApiKey("");
      toast.success(`Gemini key verified and saved (${res.data.hint}).`);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removeProjectGemini(projectId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Gemini key removed.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gemini</CardTitle>
        <CardDescription>
          Google&apos;s AI model, for this project. Paste an API key from Google AI Studio. It&apos;s checked with Google, then stored encrypted.
        </CardDescription>
        <CardAction>
          {hint ? (
            <Badge variant="secondary">
              <CheckCircle2Icon data-icon="inline-start" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hint && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <span>
              Key ending <span className="font-mono">{hint}</span>
            </span>
            <ConfirmDelete
              triggerRender={<Button size="sm" variant="outline" disabled={pending} />}
              title="Remove the Gemini key?"
              description="This project stops using Gemini until a key is added again. The key itself keeps working in Google AI Studio."
              details={[{ label: "Key", value: hint }]}
              confirmLabel="Remove"
              onConfirm={remove}
            >
              Remove
            </ConfirmDelete>
          </div>
        )}
        <form onSubmit={save} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="gemini-key">{hint ? "Replace key" : "API key"}</FieldLabel>
            <Input id="gemini-key" type="password" autoComplete="off" placeholder="AIza…" value={apiKey} disabled={pending} onChange={(e) => setApiKey(e.target.value)} />
            <FieldDescription>
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                Get a key in Google AI Studio <ExternalLinkIcon className="size-3" />
              </a>
            </FieldDescription>
          </Field>
          <Button type="submit" className="self-start" disabled={pending || !apiKey.trim()}>
            {pending && <Spinner data-icon="inline-start" />}
            {hint ? "Replace key" : "Save key"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
