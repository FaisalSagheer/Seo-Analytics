import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { InviteCard } from "@/components/team/invite-card";
import { AddUserDialog } from "@/components/team/add-user-dialog";
import { MembersCard } from "@/components/team/members-card";
import { RolesCard } from "@/components/team/roles-card";
import { db } from "@/lib/db";
import { sanitizePermissions } from "@/lib/permissions";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Team & roles" };

export default async function TeamPage() {
  const viewer = await requireAdmin();
  const [roles, users, invitations, projects] = await Promise.all([
    // Admin first, then the rest alphabetically
    db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { _count: { select: { users: true } } } }),
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, roleId: true, isActive: true, createdAt: true, role: { select: { name: true } } },
    }),
    db.invitation.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { role: { select: { name: true } } },
    }),
    // Projects a new user can be given access to; demo projects are visible to every role that sees all
    db.project.findMany({ where: { isDemo: false }, orderBy: { name: "asc" }, select: { id: true, name: true, domain: true } }),
  ]);
  const fallback = roles.find((r) => r.isDefault);
  // Users with no role row resolve to the default role, so count and show them there
  const unassigned = users.filter((u) => !u.roleId).length;

  return (
    <>
      <PageHeader title="Team & roles" />
      <div className="flex max-w-4xl flex-col gap-6">
        <InviteCard
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          invitations={invitations.map((i) => ({ id: i.id, email: i.email, roleName: i.role.name, expiresAt: i.expiresAt.toISOString() }))}
        />
        <MembersCard
          action={<AddUserDialog roles={roles.map((r) => ({ id: r.id, name: r.name, seesAll: r.isSystem || r.seeAllProjects }))} projects={projects} />}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          members={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            roleId: u.roleId ?? fallback?.id ?? "",
            roleName: u.role?.name ?? fallback?.name ?? "No role",
            createdAt: u.createdAt.toISOString(),
            isYou: u.id === viewer.id,
            isActive: u.isActive,
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
            seeAllProjects: r.isSystem || r.seeAllProjects,
            memberCount: r._count.users + (r.isDefault ? unassigned : 0),
          }))}
        />
      </div>
    </>
  );
}
