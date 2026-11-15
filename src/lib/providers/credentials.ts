import "server-only";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { Provider } from "@/generated/prisma/client";

/** Where a project's key for a provider comes from. Checked in this order. */
export type CredentialSource = "project" | "owner" | "server" | "none";

type ProjectRef = { id: string; userId: string };

export type ResolvedCredential = {
  source: "project" | "owner";
  login: string;
  secret: string;
  rankDepth: number | null;
};

/**
 * The key a project should use: its own first (the client's), then the owner's
 * account-level key from Settings. The server-wide .env key is the caller's
 * last resort because its shape differs per provider.
 */
export async function findCredential(project: ProjectRef, provider: Provider): Promise<ResolvedCredential | null> {
  const own = await db.projectCredential.findUnique({ where: { projectId_provider: { projectId: project.id, provider } } });
  if (own) return { source: "project", login: own.login, secret: decrypt(own.secretEncrypted), rankDepth: own.rankDepth };
  const owner = await db.providerCredential.findUnique({ where: { userId_provider: { userId: project.userId, provider } } });
  if (owner) return { source: "owner", login: owner.login, secret: decrypt(owner.secretEncrypted), rankDepth: owner.rankDepth };
  return null;
}

export type CredentialSummary = { source: CredentialSource; login: string | null; rankDepth: number | null };

/** Which source each provider resolves to, without decrypting anything. For the Project settings page. */
export async function getCredentialSummary(project: ProjectRef): Promise<Record<Provider, CredentialSummary>> {
  const [own, owner] = await Promise.all([
    db.projectCredential.findMany({ where: { projectId: project.id } }),
    db.providerCredential.findMany({ where: { userId: project.userId } }),
  ]);
  const e = env();
  const server: Record<Provider, boolean> = {
    DATAFORSEO: Boolean(e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD),
    SERPER: Boolean(e.SERPER_API_KEY),
    BING: Boolean(e.BING_WEBMASTER_API_KEY),
  };
  const resolve = (provider: Provider): CredentialSummary => {
    const p = own.find((c) => c.provider === provider);
    if (p) return { source: "project", login: p.login || null, rankDepth: p.rankDepth };
    const o = owner.find((c) => c.provider === provider);
    if (o) return { source: "owner", login: o.login || null, rankDepth: o.rankDepth };
    if (server[provider]) return { source: "server", login: provider === "DATAFORSEO" ? (e.DATAFORSEO_LOGIN ?? null) : null, rankDepth: provider === "SERPER" ? e.SERPER_RANK_DEPTH : null };
    return { source: "none", login: null, rankDepth: null };
  };
  return { DATAFORSEO: resolve("DATAFORSEO"), SERPER: resolve("SERPER"), BING: resolve("BING") };
}
