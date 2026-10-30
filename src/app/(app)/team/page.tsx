import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { MembersCard } from "@/components/team/members-card";
import { RolesCard } from "@/components/team/roles-card";
import { db } from "@/lib/db";
import { sanitizePermissions } from "@/lib/permissions";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Team & roles" };

export default async function TeamPage() {
  const viewer = await requireAdmin();
  const [roles, users] = await Promise.all([
    // Admin first, then the rest alphabetically
    db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { users: true } } } }),
    db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, roleId: true, createdAt: true } }),
  ]);
  const fallback = roles.find((r) => r.isDefault);
  // Users with no role row resolve to the default role, so count and show them there
  const unassigned = users.filter((u) => !u.roleId).length;

  return (
    <>
      <PageHeader title="Team & roles" description="Who's on the team and what each role can change." />
      <div className="flex max-w-4xl flex-col gap-6">
        <MembersCard
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          members={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            roleId: u.roleId ?? fallback?.id ?? "",
            createdAt: u.createdAt.toISOString(),
            isYou: u.id === viewer.id,
          }))}
        />
        <RolesCard
          roles={roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            permissions: sanitizePermissions(r.permissions),
            isSystem: r.isSystem,
            isDefault: r.isDefault,
            memberCount: r._count.users + (r.isDefault ? unassigned : 0),
          }))}
        />
      </div>
    </>
  );
}
