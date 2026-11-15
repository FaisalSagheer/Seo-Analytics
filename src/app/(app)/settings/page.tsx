import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { GoogleCard } from "@/components/settings/google-card";
import { db } from "@/lib/db";
import { env, googleConfigured } from "@/lib/env";
import { getGoogleAccount } from "@/lib/providers";
import { can, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Google & API" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser();
  const googleInUse = (await searchParams).google === "in-use";
  const e = env();
  const [canGoogle, canApiKeys] = await Promise.all([can("providers.manage"), can("apikeys.manage")]);
  const [google, keys] = await Promise.all([
    getGoogleAccount(user.id),
    db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Google & API"
        description="Connect your Google account and manage API access. A project can use its own Google service account instead, under Project settings."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {!canGoogle && !canApiKeys && (
          <p className="text-muted-foreground text-sm">Your role doesn&apos;t include connecting Google or creating API keys.</p>
        )}
        {canGoogle && <GoogleCard configured={googleConfigured()} connected={Boolean(google?.hasDataScopes)} linked={Boolean(google)} inUse={googleInUse} />}
        {canApiKeys && (
          <ApiKeysCard
            baseUrl={e.APP_URL}
            keys={keys.map((k) => ({
              id: k.id,
              name: k.name,
              prefix: k.prefix,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
              revokedAt: k.revokedAt?.toISOString() ?? null,
            }))}
          />
        )}
      </div>
    </>
  );
}
