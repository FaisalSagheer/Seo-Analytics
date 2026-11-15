import "server-only";
import { db } from "@/lib/db";
import { PERMISSION_KEYS, sanitizePermissions, type ViewerRole } from "@/lib/permissions";

const NO_ROLE: ViewerRole = { id: null, name: "No role", isAdmin: false, seeAllProjects: false, permissions: [] };

/**
 * A user's role, read from the database on every request so a change on the
 * Team page applies at once. A user with no role gets the default role.
 */
export async function resolveRole(userId: string): Promise<ViewerRole> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  const role = user?.role ?? (await db.role.findFirst({ where: { isDefault: true } }));
  if (!role) return NO_ROLE;
  return {
    id: role.id,
    name: role.name,
    isAdmin: role.isSystem,
    seeAllProjects: role.isSystem || role.seeAllProjects,
    permissions: role.isSystem ? PERMISSION_KEYS : sanitizePermissions(role.permissions),
  };
}

/**
 * Whether a user may open a project: roles that see every project always may,
 * everyone else only if they're a member. Every page, action and API call
 * goes through this, so a project's existence is never revealed to others.
 */
export async function canViewProject(role: Pick<ViewerRole, "seeAllProjects">, userId: string, projectId: string): Promise<boolean> {
  if (role.seeAllProjects) return true;
  const member = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { userId: true } });
  return Boolean(member);
}

/** The projects a user may see, oldest first. */
export async function listProjectsFor(role: Pick<ViewerRole, "seeAllProjects">, userId: string) {
  return db.project.findMany({
    where: role.seeAllProjects ? undefined : { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { keywords: true } } },
  });
}

/** The first account becomes Admin; everyone after gets the default role. */
export async function assignInitialRole(userId: string) {
  const [admin, hasAdmin, fallback] = await Promise.all([
    db.role.findFirst({ where: { isSystem: true } }),
    db.user.count({ where: { role: { isSystem: true } } }),
    db.role.findFirst({ where: { isDefault: true } }),
  ]);
  const roleId = !hasAdmin && admin ? admin.id : fallback?.id;
  if (roleId) await db.user.update({ where: { id: userId }, data: { roleId } });
}
