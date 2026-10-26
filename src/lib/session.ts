import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getProject } from "@/lib/queries";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Gate for every signed-in page and action. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

/** Owner-scoped project lookup; 404s for anyone else. */
export async function requireProject(projectId: string) {
  const user = await requireUser();
  const project = await getProject(projectId, user.id);
  if (!project) notFound();
  return { user, project };
}
