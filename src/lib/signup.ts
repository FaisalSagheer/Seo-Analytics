import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Whether people may register themselves. Off unless ALLOW_SIGNUP=true, except
 * that a server with no admin yet accepts one so the first account can set it up
 * (that account becomes Admin; see assignInitialRole).
 */
export async function signupOpen(): Promise<boolean> {
  if (env().ALLOW_SIGNUP) return true;
  return (await db.user.count({ where: { role: { isSystem: true } } })) === 0;
}
