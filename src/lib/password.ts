import { scrypt, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 8;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

/**
 * Accounts created before the move to NextAuth hold a `salt:hex` scrypt hash
 * (N=16384, r=16, p=1, 64-byte key, salt used as the hex string itself).
 */
function verifyLegacyScrypt(hash: string, password: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }, (err, derived) => {
      if (err) return resolve(false);
      const expected = Buffer.from(key, "hex");
      resolve(expected.length === derived.length && timingSafeEqual(expected, derived));
    });
  });
}

/** `needsRehash` is true when a legacy hash matched and should be replaced with bcrypt. */
export async function verifyPassword(hash: string, password: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (hash.startsWith("$2")) return { ok: await bcrypt.compare(password, hash), needsRehash: false };
  const ok = await verifyLegacyScrypt(hash, password);
  return { ok, needsRehash: ok };
}
