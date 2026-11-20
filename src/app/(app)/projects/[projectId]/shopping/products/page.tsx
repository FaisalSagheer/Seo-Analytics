import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Catalogue } from "@/components/shopping/catalogue";
import { requireProject } from "@/lib/session";
import { loadCatalogue } from "@/lib/shopping";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ params }: PageProps<"/projects/[projectId]/shopping/products">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Products" />;
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
      {data && <Catalogue projectId={project.id} rows={data.rows} truncated={data.truncated} />}
    </>
  );
}
