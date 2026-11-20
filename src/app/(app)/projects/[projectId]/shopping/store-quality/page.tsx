import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Store quality" };

/** Google's API has no store quality data, so this opens the page in Merchant Center for the project's account. */
export default async function StoreQualityPage({ params }: PageProps<"/projects/[projectId]/shopping/store-quality">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        <PageHeader title="Store quality" />
        <NoMerchant project={project} />
      </>
    );
  }
  redirect(`https://merchants.google.com/mc/storequality?a=${encodeURIComponent(project.merchantId)}`);
}
