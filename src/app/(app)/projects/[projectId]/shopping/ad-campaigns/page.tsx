import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { ShoppingAnalytics } from "@/components/shopping/analytics-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProject } from "@/lib/session";
import { loadAppsAndServices } from "@/lib/shopping";

export const metadata: Metadata = { title: "Ad campaigns" };

const STATE: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  ESTABLISHED: { label: "Linked", variant: "secondary" },
  PENDING: { label: "Waiting for you", variant: "outline" },
  WAITING: { label: "Waiting for Google Ads", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

/**
 * Shopping ads results from Merchant Center, and the Google Ads accounts linked to it. Campaign
 * details (budgets, bids) live in the Google Ads API, which this app doesn't use.
 */
export default async function AdCampaignsPage({ params, searchParams }: PageProps<"/projects/[projectId]/shopping/ad-campaigns">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const ready = !project.isDemo && Boolean(project.merchantId);
  const apps = ready ? await loadAppsAndServices(project) : null;
  const ads = (apps?.data?.services ?? []).filter((s) => s.provider === "providers/GOOGLE_ADS" || s.campaignsManagement);

  const intro = ready ? (
    <Card>
      <CardHeader>
        <CardTitle>Google Ads accounts</CardTitle>
        <CardDescription>Shopping ads run from a Google Ads account linked to this store. Budgets and bids are managed in Google Ads.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ads.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Google Ads account is linked. Link one from Google Ads (Tools → Linked accounts → Google Merchant Center), then approve it under Settings → Apps and services.</p>
        ) : (
          <ul className="divide-y text-sm">
            {ads.map((s) => {
              const st = STATE[s.handshake?.approvalState ?? ""] ?? { label: "—", variant: "outline" as const };
              return (
                <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">
                    {s.providerDisplayName || "Google Ads"}
                    {s.externalAccountId && <span className="text-muted-foreground font-normal"> · {s.externalAccountId.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3")}</span>}
                  </span>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
        <a href="https://ads.google.com/aw/campaigns" target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
          <ExternalLinkIcon data-icon="inline-start" />
          Open Google Ads
        </a>
      </CardContent>
    </Card>
  ) : undefined;

  return <ShoppingAnalytics projectId={projectId} sp={await searchParams} view="ads" intro={intro} />;
}
