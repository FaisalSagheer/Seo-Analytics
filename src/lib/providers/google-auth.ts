import "server-only";
import { createSign } from "node:crypto";
import { GOOGLE_DATA_SCOPES, MERCHANT_SCOPE } from "@/lib/providers/google";

/**
 * Service-account access for Search Console and GA4. A client creates a service
 * account, adds its email as a user on their Search Console site and GA4 property,
 * and hands over the JSON key file; no Google sign-in or OAuth consent is involved.
 */

/** Always Google's own endpoint: the key file's own `token_uri` is deliberately ignored. */
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ServiceAccountKey = { client_email: string; private_key: string; project_id?: string };

const MAX_KEY_BYTES = 10_000;

/** Reads a pasted key file. Errors say what's wrong without ever echoing the key. */
export function parseServiceAccountKey(text: string): ServiceAccountKey {
  if (!text.trim()) throw new Error("Paste the service account's JSON key.");
  if (Buffer.byteLength(text) > MAX_KEY_BYTES) throw new Error("That file is too large to be a service account key.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("That isn't valid JSON. Paste the whole key file, including the braces.");
  }
  const k = json as Record<string, unknown>;
  if (!k || typeof k !== "object" || k.type !== "service_account") {
    throw new Error('This isn\'t a service account key (its "type" must be "service_account"). Create a key for a service account, not an OAuth client.');
  }
  const email = typeof k.client_email === "string" ? k.client_email.trim() : "";
  const key = typeof k.private_key === "string" ? k.private_key : "";
  if (!/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(email)) throw new Error("The key's client_email isn't a service account address.");
  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) throw new Error("The key file has no private_key.");
  return { client_email: email, private_key: key, ...(typeof k.project_id === "string" ? { project_id: k.project_id } : {}) };
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

/** Signs a short-lived JWT with the service account key. Exported for tests. */
export function signServiceAccountJwt(key: ServiceAccountKey, audience: string, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope: [...GOOGLE_DATA_SCOPES, MERCHANT_SCOPE].join(" "), aud: audience, iat, exp: iat + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key);
  return `${header}.${claims}.${b64url(signature)}`;
}

/** Trades the service account's signed JWT for an access token. `tokenUrl` exists only so tests can point at a stub. */
export async function serviceAccountAccessToken(key: ServiceAccountKey, tokenUrl: string = GOOGLE_TOKEN_URL): Promise<string> {
  let jwt: string;
  try {
    jwt = signServiceAccountJwt(key, tokenUrl);
  } catch {
    throw new Error("The key's private_key couldn't be read. Download a fresh JSON key and try again.");
  }
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!res.ok || !body?.access_token) {
    const why = body?.error_description ?? body?.error ?? `HTTP ${res.status}`;
    throw new Error(`Google rejected the service account key: ${why}`);
  }
  return body.access_token;
}
