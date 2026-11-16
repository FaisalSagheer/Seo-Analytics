"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopyIcon, KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { assignRole, createPasswordResetLink, setMemberActive, type InviteResult } from "@/lib/actions/team";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MemberView = { id: string; name: string; email: string; roleId: string; roleName: string; createdAt: string; isYou: boolean; isActive: boolean };

export function MembersCard({ members, roles }: { members: MemberView[]; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = roles.map((r) => ({ value: r.id, label: r.name }));
  const [resetLink, setResetLink] = useState<{ member: MemberView; result: InviteResult } | null>(null);

  function makeResetLink(member: MemberView) {
    startTransition(async () => {
      const res = await createPasswordResetLink(member.id);
      if (!res.ok) return void toast.error(res.error);
      setResetLink({ member, result: res.data });
    });
  }

  function setActive(member: MemberView, active: boolean) {
    startTransition(async () => {
      const res = await setMemberActive(member.id, active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(active ? `${member.name} can sign in again` : `${member.name} is deactivated`);
      router.refresh();
    });
  }

  function change(member: MemberView, roleId: string) {
    startTransition(async () => {
      const res = await assignRole(member.id, roleId);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Role updated");
      // Leaving Admin yourself loses access to this page
      if (member.isYou) router.push("/projects");
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Everyone who has an account. A role change applies on their next page load. Deactivating blocks sign-in and API keys at once, and keeps
          everything they created.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-44">Role</TableHead>
              <TableHead className="w-40 text-right">Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <span className={m.isActive ? undefined : "text-muted-foreground"}>{m.name}</span>
                  {m.isYou && <span className="text-muted-foreground font-normal"> (you)</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell>{formatRelative(new Date(m.createdAt))}</TableCell>
                <TableCell>
                  <Select items={items} value={m.roleId} disabled={pending} onValueChange={(v) => v && v !== m.roleId && change(m, v)}>
                    <SelectTrigger size="sm" aria-label={`Role for ${m.name}`} className="w-full">
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
                </TableCell>
                <TableCell className="text-right">
                  {!m.isActive && <Badge variant="outline" className="mr-2">Deactivated</Badge>}
                  {!m.isYou && m.isActive && (
                    <Button size="sm" variant="ghost" disabled={pending} aria-label={`Reset password for ${m.name}`} onClick={() => makeResetLink(m)}>
                      <KeyRoundIcon data-icon="inline-start" />
                      Reset password
                    </Button>
                  )}
                  {m.isYou ? null : m.isActive ? (
                    <ConfirmDelete
                      triggerRender={<Button size="sm" variant="ghost" disabled={pending} />}
                      title={`Deactivate ${m.name}?`}
                      description="They can't sign in, and their API keys stop working. Their projects, keywords and history stay in place."
                      details={[
                        { label: "Name", value: m.name },
                        { label: "Email", value: m.email },
                        { label: "Role", value: m.roleName },
                      ]}
                      note="You can reactivate them at any time from this page."
                      confirmLabel="Deactivate"
                      onConfirm={() => setActive(m, false)}
                    >
                      Deactivate
                    </ConfirmDelete>
                  ) : (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setActive(m, true)}>
                      Reactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={resetLink !== null} onOpenChange={(o) => !o && setResetLink(null)}>
        <DialogContent>
          {resetLink && (
            <>
              <DialogHeader>
                <DialogTitle>Password reset link for {resetLink.member.name}</DialogTitle>
                <DialogDescription>It works once and expires in an hour. Using it signs them out everywhere else. It is shown only now.</DialogDescription>
              </DialogHeader>
              {resetLink.result.emailed ? (
                <p className="text-muted-foreground text-sm">They&apos;ve been emailed the link. You can also copy it below.</p>
              ) : resetLink.result.emailError ? (
                <Alert variant="destructive">
                  <AlertTitle>The email couldn&apos;t be sent</AlertTitle>
                  <AlertDescription>Reason: {resetLink.result.emailError}. Copy the link below and send it yourself.</AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {resetLink.result.emailConfigured ? "" : "Email isn't set up on this server. "}Copy the link below and send it yourself.
                </p>
              )}
              <div className="flex gap-2">
                <Input readOnly value={resetLink.result.link} className="font-mono text-xs" aria-label="Password reset link" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy link"
                  onClick={() => navigator.clipboard.writeText(resetLink.result.link).then(() => toast.success("Link copied"))}
                >
                  <CopyIcon />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setResetLink(null)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
