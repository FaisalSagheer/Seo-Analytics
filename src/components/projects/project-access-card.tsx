"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setProjectAccess } from "@/lib/actions/members";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

export type AccessRow = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  /** The role sees every project, so access is implied */
  seesAll: boolean;
  hasAccess: boolean;
};

/** Who can see this project. Team members whose role sees every project always can. */
export function ProjectAccessCard({ projectId, rows }: { projectId: string; rows: AccessRow[] }) {
  const [pending, startTransition] = useTransition();

  function set(userId: string, allowed: boolean) {
    startTransition(async () => {
      const res = await setProjectAccess({ projectId, userId, allowed });
      if (!res.ok) return void toast.error(res.error);
      toast.success(allowed ? "Access added" : "Access removed");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Who can see this project</CardTitle>
        <CardDescription>
          Roles that see every project always can. For a client role (one that doesn&apos;t), tick the people on their team who should see
          this project. Admins can change this; other people see the change on their next page load.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.map((r) => (
          <label key={r.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Checkbox
              aria-label={`${r.name} can see this project`}
              checked={r.seesAll || r.hasAccess}
              disabled={pending || r.seesAll}
              onCheckedChange={(c) => set(r.id, c === true)}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="text-muted-foreground block truncate text-xs">{r.email}</span>
            </span>
            <Badge variant="outline">{r.roleName}</Badge>
            {r.seesAll && <span className="text-muted-foreground hidden text-xs sm:inline">Sees all projects</span>}
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
