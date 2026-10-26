"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { fail, type ActionResult } from "@/lib/actions/result";

/** One-click sign-in to the seeded demo account. Only available with DEMO_MODE=true. */
export async function signInDemo(): Promise<ActionResult> {
  const e = env();
  if (!e.DEMO_MODE) return fail("Demo mode is disabled on this server.");
  try {
    // nextCookies() sets the session cookie from inside the action
    await auth.api.signInEmail({ body: { email: e.DEMO_EMAIL, password: e.DEMO_PASSWORD } });
  } catch {
    return fail("Demo account not found. Run `npm run db:seed` first.");
  }
  redirect("/projects");
}
