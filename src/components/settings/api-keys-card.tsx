"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { createApiKey, revokeApiKey } from "@/lib/actions/settings";
import type { ApiKeyInput } from "@/lib/validations";
import { formatDate, formatRelative } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type ApiKeyView = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null };

export function ApiKeysCard({ keys, baseUrl }: { keys: ApiKeyView[]; baseUrl: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ApiKeyInput>({ name: "" });
  const [created, setCreated] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createApiKey(draft);
      if (!res.ok) return void toast.error(res.error);
      setCreated(res.data.key);
      setDraft({ name: "" });
      router.refresh();
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeApiKey(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Key revoked");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          For scripts, dashboards and agents. Send as <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>. Keys can read
          every project you own and add keywords.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={create} className="flex gap-2">
          <Input placeholder="Key name, e.g. reporting-agent" value={draft.name} onChange={(e) => setDraft({ name: e.target.value })} aria-label="Key name" />
          <Button type="submit" disabled={pending || !draft.name.trim()}>
            <KeyRoundIcon data-icon="inline-start" />
            Create key
          </Button>
        </form>

        {created && (
          <Alert>
            <KeyRoundIcon />
            <AlertTitle>Copy this key now. It won&apos;t be shown again.</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <InputGroup>
                <InputGroupInput readOnly value={created} className="font-mono text-xs" aria-label="New API key" />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label="Copy key"
                    onClick={() => {
                      void navigator.clipboard.writeText(created);
                      toast.success("Copied");
                    }}
                  >
                    <CopyIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">
                {`curl -H "Authorization: Bearer ${created}" \\\n  ${baseUrl}/api/v1/projects`}
              </pre>
            </AlertDescription>
          </Alert>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-16 text-center">
                  No keys yet.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((k) => (
                <TableRow key={k.id} className={k.revokedAt ? "opacity-50" : undefined}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.prefix}…</TableCell>
                  <TableCell>{formatDate(k.createdAt.slice(0, 10), "long")}</TableCell>
                  <TableCell>{k.lastUsedAt ? formatRelative(new Date(k.lastUsedAt)) : "never"}</TableCell>
                  <TableCell className="text-right">
                    {k.revokedAt ? (
                      <span className="text-muted-foreground text-xs">Revoked</span>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => revoke(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
