import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/crypto";

export const RESET_HOURS = 1;

/** Replaces any earlier unused link for the user. Only the hash is stored; the link is returned once. */
export async function issueResetLink(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_HOURS * 3_600_000);
  await db.$transaction([
    db.passwordReset.deleteMany({ where: { userId, usedAt: null } }),
    db.passwordReset.create({ data: { userId, tokenHash: sha256(token), expiresAt } }),
  ]);
  return { link: `${env().APP_URL}/reset-password/${token}`, expiresAt };
}

/** The reset a token points at, if it can still be used. */
export async function findUsableReset(token: string) {
  const reset = await db.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, isActive: true, email: true } } } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date() || !reset.user.isActive) return null;
  return reset;
}
