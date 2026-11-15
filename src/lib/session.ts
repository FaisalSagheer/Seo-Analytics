import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject } from "@/lib/queries";
import { canViewProject, resolveRole } from "@/lib/roles";
import type { Permission } from "@/lib/permissions";
import { fail } from "@/lib/actions/result";

/**
 * The session is a signed JWT, so it outlives a deleted account. Loading the
 * user on every request makes removal from the team take effect immediately.
 */
export const getSession = cache(async () => {
  // auth() mints a random CSRF token, which Next only allows once the render is fully request-time
  await connection();
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, image: true } });
  return user ? { user } : null;
});

/** Gate for every signed-in page and action. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** The signed-in user's role, resolved once per request. */
export const getViewerRole = cache(async () => resolveRole((await requireUser()).id));

export async function can(permission: Permission) {
  return (await getViewerRole()).permissions.includes(permission);
}

/** For server actions: a failed result to return, or null when allowed. */
export async function denied(permission: Permission) {
  return (await can(permission)) ? null : fail("Your role doesn't allow this.");
}

/** For pages whose whole purpose needs the permission. */
export async function requirePermission(permission: Permission) {
  if (!(await can(permission))) redirect("/projects");
}

/** Team & roles management is the Admin role's alone. */
export async function requireAdmin() {
  const role = await getViewerRole();
  if (!role.isAdmin) notFound();
  return requireUser();
}

/**
 * Gate for a project's pages and actions. 404s both when it doesn't exist and when
 * the viewer isn't allowed to see it, so other projects' existence isn't revealed.
 */
export async function requireProject(projectId: string) {
  const user = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();
  if (!(await canViewProject(await getViewerRole(), user.id, project.id))) notFound();
  return { user, project };
}
