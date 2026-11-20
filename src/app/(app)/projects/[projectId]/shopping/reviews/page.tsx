import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Reviews } from "@/components/shopping/reviews";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";
import { loadReviews } from "@/lib/shopping";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ params }: PageProps<"/projects/[projectId]/shopping/reviews">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Reviews" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadReviews(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Reviews projectId={project.id} reviews={data} />}
    </>
  );
}
