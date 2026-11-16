"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { LIMITS, clientIp, rateHit, waitMessage } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/password";
import { mailConfigured, resetEmail, sendMail } from "@/lib/mail";
import { findUsableReset, issueResetLink } from "@/lib/password-reset";
import { resetPasswordSchema, resetRequestSchema, type ResetPasswordInput, type ResetRequestInput } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/**
 * Emails a reset link. The answer is the same whether or not the address has an
 * account, so this can't be used to find out who is registered.
 */
export async function requestPasswordReset(input: ResetRequestInput): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { email } = parsed.data;
  if (!mailConfigured()) return fail("This server can't send email, so it can't send reset links. Ask an admin for one.");

  const ip = await rateHit("reset-ip", clientIp(await headers()), LIMITS.resetRequestIp.max, LIMITS.resetRequestIp.window);
  if (!ip.ok) return fail(waitMessage(ip.retryAfter));
  // Per address the limit is silent: telling would reveal the account, and the real owner still has the earlier email
  const perEmail = await rateHit("reset-email", email, LIMITS.resetRequestEmail.max, LIMITS.resetRequestEmail.window);
  if (!perEmail.ok) return ok(undefined);

  const user = await db.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  if (user?.isActive) {
    try {
      const { link, expiresAt } = await issueResetLink(user.id);
      await sendMail({ to: email, ...resetEmail({ link, expiresAt }) });
    } catch (err) {
      console.error("[password-reset] could not send", err instanceof Error ? err.message : err);
    }
  }
  return ok(undefined);
}

/** Sets the new password, marks the address verified (the link proved it), and signs out every other session. */
export async function resetPassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const hit = await rateHit("reset-complete", clientIp(await headers()), LIMITS.resetComplete.max, LIMITS.resetComplete.window);
  if (!hit.ok) return fail(waitMessage(hit.retryAfter));
  const { token, password } = parsed.data;
  const bad = "This link has expired or was already used. Ask for a new one.";

  const reset = await findUsableReset(token);
  if (!reset) return fail(bad);
  const hash = await hashPassword(password);
  const now = new Date();
  const ok_ = await db
    .$transaction(async (tx) => {
      // The usedAt guard makes the link one-time even if it's submitted twice at once
      const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) return false;
      const account = await tx.account.findFirst({ where: { userId: reset.userId, providerId: "credential" } });
      if (account) await tx.account.update({ where: { id: account.id }, data: { password: hash } });
      else await tx.account.create({ data: { id: randomUUID(), accountId: reset.userId, providerId: "credential", userId: reset.userId, password: hash } });
      // Whole seconds, to match the token's issued-at: sessions from before this moment stop working
      await tx.user.update({ where: { id: reset.userId }, data: { emailVerified: true, sessionsValidFrom: new Date(Math.floor(now.getTime() / 1000) * 1000) } });
      await tx.passwordReset.deleteMany({ where: { userId: reset.userId, usedAt: null } });
      return true;
    });
  if (!ok_) return fail(bad);
  return ok(undefined);
}
