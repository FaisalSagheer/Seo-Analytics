import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProgramsCard } from "@/components/shopping/account-settings";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";
import { loadPrograms } from "@/lib/shopping";

export const metadata: Metadata = { title: "Marketing methods" };

export default async function MarketingMethodsPage({ params }: PageProps<"/projects/[projectId]/shopping/marketing-methods">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Marketing methods" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadPrograms(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <ProgramsCard projectId={project.id} programs={data} />}
    </>
  );
}
