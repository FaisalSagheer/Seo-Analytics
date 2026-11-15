"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignRole, setMemberActive } from "@/lib/actions/team";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MemberView = { id: string; name: string; email: string; roleId: string; roleName: string; createdAt: string; isYou: boolean; isActive: boolean };

export function MembersCard({ members, roles }: { members: MemberView[]; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = roles.map((r) => ({ value: r.id, label: r.name }));

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
    </Card>
  );
}
