import "server-only";
import { db } from "@/lib/db";
import { decrypt, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth";
import { demoProvider } from "@/lib/demo/provider";
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

/**
 * Demo projects always use generated data. Real projects use the owner's own
 * DataForSEO account, then the server-wide one from env, else they fail loudly.
 */
export async function getSeoProvider(project: { isDemo: boolean; userId: string }): Promise<SeoProvider> {
  if (project.isDemo) return demoProvider;
  const cred = await db.providerCredential.findUnique({
    where: { userId_provider: { userId: project.userId, provider: "DATAFORSEO" } },
  });
  if (cred) return createDataForSeo(cred.login, decrypt(cred.secretEncrypted));
  const e = env();
  if (e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD) return createDataForSeo(e.DATAFORSEO_LOGIN, e.DATAFORSEO_PASSWORD);
  throw new ProviderNotConfiguredError("Connect a DataForSEO account in Settings → Providers to fetch live data.");
}

export type RankChecker = {
  source: "DEMO" | "SERPER" | "DATAFORSEO";
  checkRank: SeoProvider["checkRank"];
};

/**
 * Rank checks prefer Serper (free tier, cheap per check) when connected, then
 * fall back to DataForSEO. Everything else still goes through getSeoProvider.
 */
export async function getRankChecker(project: { isDemo: boolean; userId: string }): Promise<RankChecker> {
  if (project.isDemo) return { source: "DEMO", checkRank: demoProvider.checkRank };
  const serper = await db.providerCredential.findUnique({
    where: { userId_provider: { userId: project.userId, provider: "SERPER" } },
  });
  const e = env();
  if (serper) {
    return { source: "SERPER", checkRank: createSerperRankChecker(decrypt(serper.secretEncrypted), serper.rankDepth ?? DEFAULT_SERPER_DEPTH) };
  }
  if (e.SERPER_API_KEY) {
    return { source: "SERPER", checkRank: createSerperRankChecker(e.SERPER_API_KEY, e.SERPER_RANK_DEPTH) };
  }
  try {
    const provider = await getSeoProvider(project);
    return { source: "DATAFORSEO", checkRank: provider.checkRank };
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) {
      throw new ProviderNotConfiguredError("Connect Serper (free tier) or DataForSEO in Settings → Providers to check rankings.");
    }
    throw err;
  }
}

/** Whether the owner (or the server) has DataForSEO credentials, without decrypting them. */
export async function hasDataForSeo(userId: string): Promise<boolean> {
  const e = env();
  if (e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD) return true;
  const count = await db.providerCredential.count({ where: { userId, provider: "DATAFORSEO" } });
  return count > 0;
}

/** The owner's Bing Webmaster Tools key, else the server-wide one, else null. */
export async function getBingApiKey(userId: string): Promise<string | null> {
  const cred = await db.providerCredential.findUnique({ where: { userId_provider: { userId, provider: "BING" } } });
  if (cred) return decrypt(cred.secretEncrypted);
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
  // Refreshes and persists the token when it is about to expire
  const tokens = await auth.api.getAccessToken({ body: { accountId: g.account.id, userId } });
  if (!tokens?.accessToken) throw new ProviderNotConfiguredError("Google returned no access token. Reconnect Google.");
  return tokens.accessToken;
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
