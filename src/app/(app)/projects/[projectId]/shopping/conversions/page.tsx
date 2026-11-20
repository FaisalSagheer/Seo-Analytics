import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { ConversionSources } from "@/components/shopping/merchant-extras";
import { requireProject } from "@/lib/session";
import { loadConversionSources } from "@/lib/shopping";

export const metadata: Metadata = { title: "Conversion settings" };

export default async function Page({ params }: PageProps<"/projects/[projectId]/shopping/conversions">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Conversion settings" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadConversionSources(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <ConversionSources projectId={project.id} sources={data} gaPropertyId={project.ga4PropertyId ?? null} />}
    </>
  );
}
