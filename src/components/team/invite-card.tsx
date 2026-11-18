"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, MailPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createInvite, revokeInvite } from "@/lib/actions/team";
import { formatRelative } from "@/lib/format";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export type InviteView = { id: string; email: string; roleName: string; expiresAt: string };

export function InviteCard({ roles, invitations }: { roles: { id: string; name: string }[]; invitations: InviteView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === "Editor")?.id ?? roles[0]?.id ?? "");
  const [link, setLink] = useState<{ url: string; expiresAt: string; email: string; emailed: boolean; emailError?: string; emailConfigured: boolean } | null>(null);
  const items = roles.map((r) => ({ value: r.id, label: r.name }));

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createInvite({ email, roleId });
      if (!res.ok) return void toast.error(res.error);
      // Shown once: only a hash is kept, so this is the only chance to copy it
      setLink({ url: res.data.link, expiresAt: res.data.expiresAt, email, emailed: res.data.emailed, emailError: res.data.emailError, emailConfigured: res.data.emailConfigured });
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInvite(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Invitation revoked");
      router.refresh();
    });
  }

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setLink(null);
      setEmail("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
        <CardDescription>
          Invite someone new. They get a one-time link, valid for 7 days, by email when email is set up on this server, or from you. The link
          works once, and only for the invited address. The role you pick is the one they start with.
        </CardDescription>
        <div className="pt-2">
          <Dialog open={open} onOpenChange={reset}>
            <DialogTrigger render={<Button size="sm" />}>
              <MailPlusIcon data-icon="inline-start" />
              Invite someone
            </DialogTrigger>
            <DialogContent>
              {link ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{link.emailed ? `Invitation sent to ${link.email}` : `Invitation for ${link.email}`}</DialogTitle>
                    <DialogDescription>
                      The link expires {formatRelative(new Date(link.expiresAt))}. Copy it now: you won&apos;t see it again.
                    </DialogDescription>
                  </DialogHeader>
                  {link.emailed ? (
                    <p className="text-muted-foreground text-sm">They&apos;ve been emailed the link. You can also copy it below.</p>
                  ) : link.emailError ? (
                    <Alert variant="destructive">
                      <AlertTitle>The email couldn&apos;t be sent</AlertTitle>
                      <AlertDescription>
                        Reason: {link.emailError}. Copy the link below and send it yourself.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      {link.emailConfigured ? "" : "Email isn't set up on this server. "}Copy the link below and send it yourself.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input readOnly value={link.url} className="font-mono text-xs" aria-label="Invitation link" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copy link"
                      onClick={() => navigator.clipboard.writeText(link.url).then(() => toast.success("Link copied"))}
                    >
                      <CopyIcon />
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => reset(false)}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <form onSubmit={create} className="flex flex-col gap-6">
                  <DialogHeader>
                    <DialogTitle>Invite someone</DialogTitle>
                    <DialogDescription>They&apos;ll set their own password. Pick the role they start with; you can change it later.</DialogDescription>
                  </DialogHeader>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="inv-new-email">Email</FieldLabel>
                      <Input id="inv-new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      <FieldDescription>The link only works for this address.</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel>Role</FieldLabel>
                      <Select items={items} value={roleId} onValueChange={(v) => v && setRoleId(v)}>
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
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button type="submit" disabled={pending || !email || !roleId}>
                      {pending && <Spinner data-icon="inline-start" />}
                      Create link
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending invitations.</p>
        ) : (
          <ul className="divide-y">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.email}</span>
                  <span className="text-muted-foreground block text-xs">
                    {i.roleName} · expires {formatRelative(new Date(i.expiresAt))}
                  </span>
                </span>
                <ConfirmDelete
                  triggerRender={<Button size="sm" variant="ghost" disabled={pending} />}
                  title={`Revoke the invitation for ${i.email}?`}
                  description="The link stops working straight away. You can send a new one afterwards."
                  details={[
                    { label: "Email", value: i.email },
                    { label: "Role", value: i.roleName },
                  ]}
                  confirmLabel="Revoke"
                  onConfirm={() => revoke(i.id)}
                >
                  Revoke
                </ConfirmDelete>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
