import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { DataForSeoCard } from "@/components/settings/dataforseo-card";
import { GoogleCard } from "@/components/settings/google-card";
import { SerperCard } from "@/components/settings/serper-card";
import { BingCard } from "@/components/settings/bing-card";
import { db } from "@/lib/db";
import { env, googleConfigured } from "@/lib/env";
import { getGoogleAccount } from "@/lib/providers";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Providers & API" };

export default async function SettingsPage() {
  const user = await requireUser();
  const e = env();
  const [cred, serper, bing, google, keys] = await Promise.all([
    db.providerCredential.findUnique({ where: { userId_provider: { userId: user.id, provider: "DATAFORSEO" } } }),
    db.providerCredential.findUnique({ where: { userId_provider: { userId: user.id, provider: "SERPER" } } }),
    db.providerCredential.findUnique({ where: { userId_provider: { userId: user.id, provider: "BING" } } }),
    getGoogleAccount(user.id),
    db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader title="Providers & API" description="Connect your own data accounts and manage API access." />
      <div className="flex max-w-3xl flex-col gap-6">
        <SerperCard
          connected={Boolean(serper)}
          rankDepth={serper?.rankDepth ?? e.SERPER_RANK_DEPTH}
          envFallback={Boolean(e.SERPER_API_KEY)}
        />
        <DataForSeoCard login={cred?.login ?? null} envFallback={Boolean(e.DATAFORSEO_LOGIN && e.DATAFORSEO_PASSWORD)} />
        <BingCard connected={Boolean(bing)} envFallback={Boolean(e.BING_WEBMASTER_API_KEY)} />
        <GoogleCard configured={googleConfigured()} connected={Boolean(google?.hasDataScopes)} />
        <ApiKeysCard
          baseUrl={e.BETTER_AUTH_URL}
          keys={keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </>
  );
}
