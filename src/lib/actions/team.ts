"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/crypto";
import { getViewerRole, requireUser } from "@/lib/session";
import { inviteEmail, mailConfigured, resetEmail, sendMail } from "@/lib/mail";
import { issueResetLink } from "@/lib/password-reset";
import { inviteSchema, roleSchema, type InviteInput, type RoleInput } from "@/lib/validations";
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

const INVITE_DAYS = 7;

/** Blocks sign-in and existing sessions without deleting anything the person created. */
export async function setMemberActive(userId: string, active: boolean): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const me = await requireUser();
  if (userId === me.id) return fail("You can't deactivate your own account. Ask another admin.");
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return fail("That user no longer exists.");
  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  return done();
}

/**
 * Creates a one-time sign-up link for a new person. The link is shown once; only
 * its hash is stored, so it can't be recovered later, only revoked or replaced.
 */
export type InviteResult = { link: string; expiresAt: string; emailed: boolean; emailError?: string; emailConfigured: boolean };

export async function createInvite(input: InviteInput): Promise<ActionResult<InviteResult>> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { email, roleId } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return fail("That email already has an account. Change their role on Team instead.");
  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role) return fail("That role no longer exists.");

  // A new invite for the same person replaces the old link
  await db.invitation.deleteMany({ where: { email, acceptedAt: null } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const me = await requireUser();
  await db.invitation.create({ data: { email, roleId, tokenHash: sha256(token), invitedById: me.id, expiresAt } });
  const link = `${env().APP_URL}/invite/${token}`;
  const result: InviteResult = { link, expiresAt: expiresAt.toISOString(), emailed: false, emailConfigured: mailConfigured() };
  if (!result.emailConfigured) return ok(result);
  // The invite exists even if the email fails, so the admin can copy the link instead
  try {
    const inviter = await db.user.findUnique({ where: { id: me.id }, select: { name: true } });
    await sendMail({ to: email, ...inviteEmail({ to: email, link, roleName: role.name, inviterName: inviter?.name ?? "", expiresAt }) });
    result.emailed = true;
  } catch (err) {
    result.emailError = err instanceof Error ? err.message : "The email couldn't be sent.";
  }
  return ok(result);
}

export async function revokeInvite(invitationId: string): Promise<ActionResult> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  await db.invitation.deleteMany({ where: { id: invitationId, acceptedAt: null } });
  return done();
}

/** For someone who can't get the email: the admin makes a one-time reset link and passes it on. */
export async function createPasswordResetLink(userId: string): Promise<ActionResult<InviteResult>> {
  const blocked = await adminOnly();
  if (blocked) return blocked;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, isActive: true } });
  if (!user) return fail("That user no longer exists.");
  if (!user.isActive) return fail("Reactivate this account first.");
  const me = await requireUser();
  const { link, expiresAt } = await issueResetLink(user.id);
  const result: InviteResult = { link, expiresAt: expiresAt.toISOString(), emailed: false, emailConfigured: mailConfigured() };
  if (!result.emailConfigured) return ok(result);
  try {
    const inviter = await db.user.findUnique({ where: { id: me.id }, select: { name: true } });
    await sendMail({ to: user.email, ...resetEmail({ link, expiresAt, byAdmin: inviter?.name ?? "A team admin" }) });
    result.emailed = true;
  } catch (err) {
    result.emailError = err instanceof Error ? err.message : "The email couldn't be sent.";
  }
  return ok(result);
}
