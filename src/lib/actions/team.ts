"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewerRole } from "@/lib/session";
import { roleSchema, type RoleInput } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/** Team and role changes are the Admin role's alone. */
async function adminOnly() {
  return (await getViewerRole()).isAdmin ? null : fail("Only admins can manage the team.");
}

function done() {
  // Roles change what the whole shell shows, not just this page
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function createRole(input: RoleInput): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  if (await db.role.findUnique({ where: { name: parsed.data.name } })) return fail("A role with that name already exists.");
  await db.role.create({ data: parsed.data });
  return done();
}

export async function updateRole(roleId: string, input: RoleInput): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return fail("That role no longer exists.");
  if (role.isSystem) return fail("The Admin role can't be edited.");
  const clash = await db.role.findUnique({ where: { name: parsed.data.name } });
  if (clash && clash.id !== roleId) return fail("A role with that name already exists.");
  await db.role.update({ where: { id: roleId }, data: parsed.data });
  return done();
}

/** Members on the deleted role move to the default role. */
export async function deleteRole(roleId: string): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return fail("That role no longer exists.");
  if (role.isSystem) return fail("The Admin role can't be deleted.");
  if (role.isDefault) return fail("Make another role the default before deleting this one.");
  const fallback = await db.role.findFirst({ where: { isDefault: true } });
  await db.$transaction([
    db.user.updateMany({ where: { roleId }, data: { roleId: fallback?.id ?? null } }),
    db.role.delete({ where: { id: roleId } }),
  ]);
  return done();
}

export async function setDefaultRole(roleId: string): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return fail("That role no longer exists.");
  // New sign-ups landing on Admin would hand the whole team to strangers
  if (role.isSystem) return fail("The Admin role can't be the default for new sign-ups.");
  await db.$transaction([
    db.role.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    db.role.update({ where: { id: roleId }, data: { isDefault: true } }),
  ]);
  return done();
}

export async function assignRole(userId: string, roleId: string): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const [user, role] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, include: { role: true } }),
    db.role.findUnique({ where: { id: roleId } }),
  ]);
  if (!user || !role) return fail("That user or role no longer exists.");
  if (user.role?.isSystem && !role.isSystem) {
    const admins = await db.user.count({ where: { role: { isSystem: true } } });
    if (admins <= 1) return fail("The team needs at least one admin. Make someone else an admin first.");
  }
  await db.user.update({ where: { id: userId }, data: { roleId } });
  return done();
}
