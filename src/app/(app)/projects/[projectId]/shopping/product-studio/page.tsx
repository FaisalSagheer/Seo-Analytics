import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { ProductStudio } from "@/components/shopping/product-studio";
import { requireProject } from "@/lib/session";
import { loadCatalogue } from "@/lib/shopping";

export const metadata: Metadata = { title: "Product Studio" };

export default async function ProductStudioPage({ params }: PageProps<"/projects/[projectId]/shopping/product-studio">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Product Studio" />;
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
      {data && <ProductStudio projectId={project.id} rows={data.rows} />}
    </>
  );
}
