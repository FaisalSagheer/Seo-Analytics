import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Feeds } from "@/components/shopping/feeds";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { requireProject } from "@/lib/session";
import { loadFeeds } from "@/lib/shopping";

export const metadata: Metadata = { title: "Feeds" };

export default async function FeedsPage({ params }: PageProps<"/projects/[projectId]/shopping/feeds">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Feeds" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadFeeds(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Feeds projectId={project.id} feeds={data} />}
    </>
  );
}
