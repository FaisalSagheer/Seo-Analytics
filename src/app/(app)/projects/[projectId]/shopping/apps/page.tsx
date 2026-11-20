import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { AppsAndServices } from "@/components/shopping/merchant-extras";
import { requireProject } from "@/lib/session";
import { loadAppsAndServices } from "@/lib/shopping";

export const metadata: Metadata = { title: "Apps and services" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/shopping/apps">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Apps and services" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadAppsAndServices(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <AppsAndServices projectId={project.id} data={data} />}
    </>
  );
}
