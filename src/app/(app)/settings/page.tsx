import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiKeysCard } from "@/components/settings/api-keys-card";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { can, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "API keys" };

export default async function SettingsPage() {
  const user = await requireUser();
  const e = env();
  const canApiKeys = await can("apikeys.create");
  const keys = await db.apiKey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys that let your own tools read this app's data. Each key shows once when it's created."
      />
      <div className="flex max-w-3xl flex-col gap-6">
        {!canApiKeys && <p className="text-muted-foreground text-sm">Your role doesn&apos;t include creating API keys.</p>}
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
