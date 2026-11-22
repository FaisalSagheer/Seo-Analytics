import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/crypto";

/** Counters live in the database so they hold across restarts and several app instances. */
const key = (scope: string, id: string) => `${scope}:${sha256(id.toLowerCase()).slice(0, 40)}`;

/** The caller's address as the last trusted proxy saw it; "unknown" when the header can't be trusted. */
export function clientIp(headers: Pick<Headers, "get">): string {
  const hops = env().TRUSTED_PROXY_HOPS;
  if (hops <= 0) return "unknown";
  const list = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return headers.get("x-real-ip")?.trim() || "unknown";
  // Entries are appended left to right, so the client-supplied ones are on the left; count from the right
  return list[Math.max(0, list.length - hops)].slice(0, 64);
}

export type RateResult = { ok: boolean; retryAfter: number };

/** Records one attempt. `ok` is false once the window's count passes `max`. */
export async function rateHit(scope: string, id: string, max: number, windowSec: number): Promise<RateResult> {
  const k = key(scope, id);
  await db.$executeRaw`
    INSERT INTO ratelimit (\`key\`, count, resetAt) VALUES (${k}, 1, DATE_ADD(NOW(3), INTERVAL ${windowSec} SECOND))
    ON DUPLICATE KEY UPDATE
      count = IF(resetAt <= NOW(3), 1, count + 1),
      resetAt = IF(resetAt <= NOW(3), DATE_ADD(NOW(3), INTERVAL ${windowSec} SECOND), resetAt)`;
  const rows = await db.$queryRaw<{ count: number | bigint; wait: number | bigint }[]>`
    SELECT count, TIMESTAMPDIFF(SECOND, NOW(3), resetAt) AS wait FROM ratelimit WHERE \`key\` = ${k}`;
  // Housekeeping: now and then drop windows that ended long ago
  if (Math.random() < 0.01) db.$executeRaw`DELETE FROM ratelimit WHERE resetAt < DATE_SUB(NOW(3), INTERVAL 1 DAY)`.catch(() => {});
  const row = rows[0];
  return { ok: Number(row?.count ?? 1) <= max, retryAfter: Math.max(1, Number(row?.wait ?? windowSec)) };
}

/** True when `max` attempts are already recorded in the current window (records nothing). */
export async function rateExceeded(scope: string, id: string, max: number): Promise<boolean> {
  const rows = await db.$queryRaw<{ count: number | bigint }[]>`
    SELECT count FROM ratelimit WHERE \`key\` = ${key(scope, id)} AND resetAt > NOW(3)`;
  return Number(rows[0]?.count ?? 0) >= max;
}

export async function rateClear(scope: string, id: string) {
  await db.rateLimit.deleteMany({ where: { key: key(scope, id) } });
}

/** One place for the numbers. Windows are in seconds. */
export const LIMITS = {
  /** Failed sign-ins only; a success clears the account's count */
  loginEmail: { max: 8, window: 15 * 60 },
  loginIp: { max: 60, window: 15 * 60 },
  signup: { max: 10, window: 60 * 60 },
  invite: { max: 20, window: 60 * 60 },
  resetRequestEmail: { max: 3, window: 60 * 60 },
  resetRequestIp: { max: 10, window: 60 * 60 },
  resetComplete: { max: 10, window: 60 * 60 },
  /** URL inspections per project; Google allows about 2,000 per site a day */
  inspect: { max: 200, window: 60 * 60 },
  /** Requests with a missing or wrong API key */
} as const;

export function waitMessage(retryAfter: number) {
  const mins = Math.ceil(retryAfter / 60);
  return `Too many attempts. Try again in ${mins <= 1 ? "a minute" : `${mins} minutes`}.`;
}
