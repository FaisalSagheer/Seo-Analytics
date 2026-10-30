"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { assignRole } from "@/lib/actions/team";
import { formatRelative } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type MemberView = { id: string; name: string; email: string; roleId: string; createdAt: string; isYou: boolean };

export function MembersCard({ members, roles }: { members: MemberView[]; roles: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items = roles.map((r) => ({ value: r.id, label: r.name }));

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
        <CardDescription>Everyone who has signed in. A role change applies on their next page load.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-44">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  {m.name}
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
