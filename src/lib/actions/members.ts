"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewerRole, requireProject } from "@/lib/session";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

const schema = z.object({ projectId: z.string().min(1), userId: z.string().min(1), allowed: z.boolean() });

/**
 * Lets one team member see one project. Admin only, like the rest of team management.
 * Roles that see every project don't need this; it matters for client roles.
 */
export async function setProjectAccess(input: { projectId: string; userId: string; allowed: boolean }): Promise<ActionResult> {
  if (!(await getViewerRole()).isAdmin) return fail("Only admins can change who sees a project.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { projectId, userId, allowed } = parsed.data;
  const { project } = await requireProject(projectId);
  if (project.isDemo) return fail("The demo project is visible to roles that see every project.");
  if (allowed) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return fail("That user no longer exists.");
    await db.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
    });
  } else {
    await db.projectMember.deleteMany({ where: { projectId, userId } });
  }
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(undefined);
}
