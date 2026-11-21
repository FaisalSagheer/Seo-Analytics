import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Brand } from "@/components/shopping/brand";
import { requireProject } from "@/lib/session";
import { loadBrand } from "@/lib/shopping";

export const metadata: Metadata = { title: "Brand" };

export default async function BrandPage({ params }: PageProps<"/projects/[projectId]/shopping/brand">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Brand" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadBrand(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Brand projectId={project.id} data={data} />}
    </>
  );
}
