import "server-only";
import { db } from "@/lib/db";
import { decrypt, encrypt, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { demoProvider } from "@/lib/demo/provider";
import { findCredential } from "@/lib/providers/credentials";
import { createDataForSeo } from "@/lib/providers/dataforseo";
import { GOOGLE_DATA_SCOPES } from "@/lib/providers/google";
import { DEFAULT_SERPER_DEPTH, createSerperRankChecker } from "@/lib/providers/serper";
import type { SeoProvider } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

type ProjectRef = { id: string; isDemo: boolean; userId: string };

/**
 * Demo projects always use generated data. Real projects use their own
 * DataForSEO key, then the owner's account key, then the server-wide one from
 * env, else they fail loudly.
 */
export async function getSeoProvider(project: ProjectRef): Promise<SeoProvider> {
  if (project.isDemo) return demoProvider;
  const cred = await findCredential(project, "DATAFORSEO");
  if (cred) return createDataForSeo(cred.login, cred.secret);
  const e = env();
  if (e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD) return createDataForSeo(e.DATAFORSEO_LOGIN, e.DATAFORSEO_PASSWORD);
  throw new ProviderNotConfiguredError("Add a DataForSEO key in Project settings (or connect one in Settings → Providers) to fetch live data.");
}

export type RankChecker = {
  source: "DEMO" | "SERPER" | "DATAFORSEO";
  checkRank: SeoProvider["checkRank"];
};

/**
 * Rank checks prefer Serper (free tier, cheap per check) when connected, then
 * fall back to DataForSEO. Everything else still goes through getSeoProvider.
 */
export async function getRankChecker(project: ProjectRef): Promise<RankChecker> {
  if (project.isDemo) return { source: "DEMO", checkRank: demoProvider.checkRank };
  const serper = await findCredential(project, "SERPER");
  const e = env();
  if (serper) {
    return { source: "SERPER", checkRank: createSerperRankChecker(serper.secret, serper.rankDepth ?? DEFAULT_SERPER_DEPTH) };
  }
  if (e.SERPER_API_KEY) {
    return { source: "SERPER", checkRank: createSerperRankChecker(e.SERPER_API_KEY, e.SERPER_RANK_DEPTH) };
  }
  try {
    const provider = await getSeoProvider(project);
    return { source: "DATAFORSEO", checkRank: provider.checkRank };
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      throw new ProviderNotConfiguredError("Pick a Search Console site in Project settings (free), or add a Serper or DataForSEO key there, to track rankings.");
    }
    throw err;
  }
}

/** Whether the project (its own key, its owner, or the server) has DataForSEO credentials, without decrypting them. */
export async function hasDataForSeo(project: { id: string; userId: string }): Promise<boolean> {
  const e = env();
  if (e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD) return true;
  const [own, owner] = await Promise.all([
    db.projectCredential.count({ where: { projectId: project.id, provider: "DATAFORSEO" } }),
    db.providerCredential.count({ where: { userId: project.userId, provider: "DATAFORSEO" } }),
  ]);
  return own + owner > 0;
}

/** The project's Bing Webmaster Tools key, else its owner's, else the server-wide one, else null. */
export async function getBingApiKey(project: { id: string; userId: string }): Promise<string | null> {
  const cred = await findCredential(project, "BING");
  if (cred) return cred.secret;
  return env().BING_WEBMASTER_API_KEY || null;
}

/** The user's linked Google account, if it has granted the Search Console + GA4 scopes. */
export async function getGoogleAccount(userId: string) {
  const account = await db.account.findFirst({ where: { userId, providerId: "google" }, orderBy: { updatedAt: "desc" } });
  if (!account) return null;
  const scopes = (account.scope ?? "").split(/[ ,]+/);
  const hasDataScopes = GOOGLE_DATA_SCOPES.every((s) => scopes.includes(s));
  return { account, hasDataScopes };
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const g = await getGoogleAccount(userId);
  if (!g || !g.hasDataScopes) {
    throw new ProviderNotConfiguredError("Connect Google in Settings → Providers to sync Search Console and GA4.");
  }
  const { account } = g;
  const reconnect = () => new ProviderNotConfiguredError("Your Google connection has expired. Reconnect Google in Settings → Providers.");
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

/** Read-through cache for paid lookups (keyword ideas, ad-hoc domain overviews). */
export async function cached<T>(parts: unknown[], ttlHours: number, load: () => Promise<T>): Promise<T> {
  const key = sha256(JSON.stringify(parts));
  const hit = await db.providerCache.findUnique({ where: { key } });
  if (hit && hit.expiresAt > new Date()) return hit.payload as T;
  const value = await load();
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  const payload = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  await db.providerCache.upsert({ where: { key }, create: { key, payload, expiresAt }, update: { payload, expiresAt } });
  return value;
}
