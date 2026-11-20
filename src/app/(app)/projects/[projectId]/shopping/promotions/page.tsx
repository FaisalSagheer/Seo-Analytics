import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Promotions } from "@/components/shopping/promotions";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";
import { loadPromotions } from "@/lib/shopping";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage({ params }: PageProps<"/projects/[projectId]/shopping/promotions">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Promotions" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadPromotions(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Promotions projectId={project.id} promotions={data} />}
    </>
  );
}
