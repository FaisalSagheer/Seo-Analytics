import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { AutomaticImprovementsCard } from "@/components/shopping/merchant-extras";
import { requireProject } from "@/lib/session";
import { loadAutomaticImprovements } from "@/lib/shopping";

export const metadata: Metadata = { title: "Automatic improvements" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/shopping/automatic-improvements">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Automatic improvements" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadAutomaticImprovements(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <AutomaticImprovementsCard key={JSON.stringify(data)} projectId={project.id} doc={data} />}
    </>
  );
}
