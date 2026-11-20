import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";

// Merchant Center pages Google's API doesn't cover; the sidebar opens them in Merchant Center itself
const PAGES: Record<string, { title: string; path: string }> = {
  "store-quality": { title: "Store quality", path: "storequality" },
  "product-studio": { title: "Product Studio", path: "productstudio" },
  "video-assets": { title: "Video assets", path: "videoassets" },
  "ad-campaigns": { title: "Ad campaigns", path: "campaigns" },
  brand: { title: "Brand", path: "brand" },
};

export async function generateMetadata({ params }: PageProps<"/projects/[projectId]/shopping/mc/[page]">): Promise<Metadata> {
  return { title: PAGES[(await params).page]?.title ?? "Merchant Center" };
}

export default async function MerchantCenterLink({ params }: PageProps<"/projects/[projectId]/shopping/mc/[page]">) {
  const { projectId, page } = await params;
  const target = PAGES[page];
  if (!target) notFound();
  const { project } = await requireProject(projectId);
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        <PageHeader title={target.title} />
        <NoMerchant project={project} />
      </>
    );
  }
  redirect(`https://merchants.google.com/mc/${target.path}?a=${encodeURIComponent(project.merchantId)}`);
}
