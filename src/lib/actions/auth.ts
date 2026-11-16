"use server";

import { randomUUID } from "node:crypto";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { headers } from "next/headers";
import { signupOpen } from "@/lib/signup";
import { LIMITS, clientIp, rateHit, waitMessage } from "@/lib/rate-limit";
import { MIN_PASSWORD_LENGTH, hashPassword } from "@/lib/password";
import { assignInitialRole } from "@/lib/roles";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase().max(191),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`).max(128),
});

/** Creates an email + password account. The client signs in afterwards. */
export async function registerUser(input: { name: string; email: string; password: string }): Promise<ActionResult> {
  if (!(await signupOpen())) return fail("Sign-ups are disabled on this server.");
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const hit = await rateHit("signup", clientIp(await headers()), LIMITS.signup.max, LIMITS.signup.window);
  if (!hit.ok) return fail(waitMessage(hit.retryAfter));
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return fail("An account with this email already exists.");
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name,
      email,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    },
  });
  await assignInitialRole(id);
  return ok(undefined);
}

/** One-click sign-in to the seeded demo account. Only available with DEMO_MODE=true. */
export async function signInDemo(): Promise<ActionResult> {
  const e = env();
  if (!e.DEMO_MODE) return fail("Demo mode is disabled on this server.");
  try {
    await signIn("credentials", { email: e.DEMO_EMAIL, password: e.DEMO_PASSWORD, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) return fail("Demo account not found. Run `npm run db:seed` first.");
    throw err;
  }
  return ok(undefined);
}
