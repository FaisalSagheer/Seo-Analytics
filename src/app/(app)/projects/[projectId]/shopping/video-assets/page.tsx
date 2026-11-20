import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { VideoAssets } from "@/components/shopping/video-assets";
import { requireProject } from "@/lib/session";
import { loadCatalogue } from "@/lib/shopping";

export const metadata: Metadata = { title: "Video assets" };

export default async function VideoAssetsPage({ params }: PageProps<"/projects/[projectId]/shopping/video-assets">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Video assets" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadCatalogue(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <VideoAssets projectId={project.id} rows={data.rows} />}
    </>
  );
}
