import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProject } from "@/lib/queries";
import { resolveRole } from "@/lib/roles";
import type { Permission } from "@/lib/permissions";
import { fail } from "@/lib/actions/result";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

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

/** Projects are shared across the team; 404s only when it doesn't exist. */
export async function requireProject(projectId: string) {
  const user = await requireUser();
  const project = await getProject(projectId);
  if (!project) notFound();
  return { user, project };
}
