"use server";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { acceptInviteSchema, type AcceptInviteInput } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/** Turns an invite link into an account with the invited role. Works once. */
export async function acceptInvite(input: AcceptInviteInput): Promise<ActionResult<{ email: string }>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { token, name, password } = parsed.data;

  const invite = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return fail("This invitation has expired or was already used. Ask an admin for a new link.");
  }
  if (await db.user.findUnique({ where: { email: invite.email } })) {
    return fail("An account with this email already exists. Sign in instead.");
  }

  const userId = randomUUID();
  // The acceptedAt guard makes the link one-time even if it's used twice at the same moment
  await db.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("INVITE_USED");
    await tx.user.create({
      data: {
        id: userId,
        email: invite.email,
        name,
        emailVerified: true,
        roleId: invite.roleId,
        accounts: {
          create: { id: randomUUID(), accountId: userId, providerId: "credential", password: await hashPassword(password) },
        },
      },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "INVITE_USED") return null;
    throw err;
  });
  const used = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!used) return fail("This invitation has expired or was already used. Ask an admin for a new link.");
  return ok({ email: invite.email });
}
