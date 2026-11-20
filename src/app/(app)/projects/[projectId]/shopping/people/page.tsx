import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeopleCard } from "@/components/shopping/account-settings";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";
import { loadPeople } from "@/lib/shopping";

export const metadata: Metadata = { title: "People and access" };

export default async function PeoplePage({ params }: PageProps<"/projects/[projectId]/shopping/people">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="People and access" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadPeople(project);
  return (
    <>
      {header}
      {problem ? <ProblemAlert problem={problem} projectId={project.id} /> : <PeopleCard projectId={project.id} users={data} />}
    </>
  );
}
