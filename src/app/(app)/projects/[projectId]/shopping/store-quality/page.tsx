import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, ExternalLinkIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProject } from "@/lib/session";
import { loadStoreQuality } from "@/lib/shopping";

export const metadata: Metadata = { title: "Store quality" };

export default async function StoreQualityPage({ params }: PageProps<"/projects/[projectId]/shopping/store-quality">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const ready = !project.isDemo && Boolean(project.merchantId);
  const header = (
    <PageHeader
      title="Store quality"
      actions={
        ready ? (
          <a href={`/projects/${project.id}/shopping/mc/store-quality`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLinkIcon data-icon="inline-start" />
            Google&apos;s ratings
          </a>
        ) : undefined
      }
    />
  );
  if (!ready) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadStoreQuality(project);
  const passed = data?.filter((c) => c.ok).length ?? 0;
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>
              {passed} of {data.length} checks passed
            </CardTitle>
            <CardDescription>
              What shapes Google&apos;s store quality ratings (shipping, returns, customer service), checked from this Merchant Center account. Google&apos;s own ratings aren&apos;t available
              through its API; open them with Google&apos;s ratings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {[...data]
                .sort((a, b) => Number(a.ok) - Number(b.ok))
                .map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-3">
                    {c.ok ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">{c.label}</span>
                      <span className="text-muted-foreground text-xs">{c.detail}</span>
                    </div>
                    {!c.ok && (
                      <Link href={c.fix} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                        Fix
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
