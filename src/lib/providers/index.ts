import "server-only";
import { db } from "@/lib/db";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { GOOGLE_DATA_SCOPES } from "@/lib/providers/google";
import { parseServiceAccountKey, serviceAccountAccessToken } from "@/lib/providers/google-auth";

export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

/** The user's linked Google account, if it has granted the Search Console + GA4 scopes. */
export async function getGoogleAccount(userId: string) {
  const account = await db.account.findFirst({ where: { userId, providerId: "google" }, orderBy: { updatedAt: "desc" } });
  if (!account) return null;
  const scopes = (account.scope ?? "").split(/[ ,]+/);
  const hasDataScopes = GOOGLE_DATA_SCOPES.every((s) => scopes.includes(s));
  return { account, hasDataScopes };
}

type ProjectRef = { id: string; userId: string };

/** Which Google access a project uses: its own service account, else its owner's Google connection. */
export async function getGoogleSource(project: ProjectRef): Promise<{ source: "project" | "owner" | "none"; email: string | null }> {
  const own = await db.projectCredential.findUnique({ where: { projectId_provider: { projectId: project.id, provider: "GOOGLE" } } });
  if (own) return { source: "project", email: own.login };
  const g = await getGoogleAccount(project.userId);
  return g?.hasDataScopes ? { source: "owner", email: null } : { source: "none", email: null };
}

/**
 * A Google access token for a project's Search Console and GA4 calls. The
 * project's own service account (the client's) wins; otherwise the project
 * owner's Google connection from Settings is used.
 */
/**
 * Service account tokens last an hour. Minting a new one for every request would also defeat the
 * response cache (its key includes the token), so each key's token is reused until shortly before it expires.
 */
const SA_TOKEN_TTL_MS = 50 * 60_000;
const saTokens = new Map<string, { token: string; until: number }>();

async function serviceAccountToken(secretEncrypted: string): Promise<string> {
  const id = sha256(secretEncrypted);
  const cached = saTokens.get(id);
  if (cached && cached.until > Date.now()) return cached.token;
  const token = await serviceAccountAccessToken(parseServiceAccountKey(decrypt(secretEncrypted)));
  saTokens.set(id, { token, until: Date.now() + SA_TOKEN_TTL_MS });
  return token;
}

export async function getGoogleAccessToken(project: ProjectRef): Promise<string> {
  const own = await db.projectCredential.findUnique({ where: { projectId_provider: { projectId: project.id, provider: "GOOGLE" } } });
  if (own) {
    try {
      return await serviceAccountToken(own.secretEncrypted);
    } catch (err) {
      throw new ProviderNotConfiguredError(
        `This project's Google service account (${own.login}) didn't work: ${err instanceof Error ? err.message : String(err)}. Replace the key in Project settings.`,
      );
    }
  }
  return getOwnerGoogleAccessToken(project.userId);
}

async function getOwnerGoogleAccessToken(userId: string): Promise<string> {
  const g = await getGoogleAccount(userId);
  if (!g || !g.hasDataScopes) {
    throw new ProviderNotConfiguredError("Give this project a Google service account in Project settings, or connect Google under Project settings → Google connection.");
  }
  const { account } = g;
  const reconnect = () => new ProviderNotConfiguredError("Your Google connection has expired. Reconnect Google under Project settings → Google connection.");
  // Tokens stored by the previous auth library were encrypted with its own key and can't be read
  const read = (value: string | null) => {
    if (!value) return null;
    try {
      return decrypt(value);
    } catch {
      return null;
    }
  };
  const accessToken = read(account.accessToken);
  const expiresAt = account.accessTokenExpiresAt?.getTime() ?? 0;
  if (accessToken && expiresAt - Date.now() > 60_000) return accessToken;

  const refreshToken = read(account.refreshToken);
  const e = env();
  if (!refreshToken || !e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) throw reconnect();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.GOOGLE_CLIENT_ID,
      client_secret: e.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; refresh_token?: string } | null;
  // invalid_grant: the user revoked access or the refresh token aged out
  if (!res.ok || !body?.access_token) throw reconnect();
  await db.account.update({
    where: { id: account.id },
    data: {
      accessToken: encrypt(body.access_token),
      accessTokenExpiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
      ...(body.refresh_token ? { refreshToken: encrypt(body.refresh_token) } : {}),
    },
  });
  return body.access_token;
}
