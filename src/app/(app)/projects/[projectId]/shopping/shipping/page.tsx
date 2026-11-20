import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { RegionsCard } from "@/components/shopping/regions-card";
import { ReturnPolicies } from "@/components/shopping/return-policies";
import { ShippingEditor } from "@/components/shopping/shipping-editor";
import { regionsInUse } from "@/lib/merchant-shipping";
import { requireProject } from "@/lib/session";
import { loadShippingPage } from "@/lib/shopping";

export const metadata: Metadata = { title: "Shipping & returns" };

export default async function ShippingPage({ params }: PageProps<"/projects/[projectId]/shopping/shipping">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Shipping & returns" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadShippingPage(project);
  const regions = (data?.regions ?? []).map((r) => {
    const id = r.name?.split("/").pop() ?? "";
    return { id, label: r.displayName || id };
  });
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && (
        <>
          {/* keyed by etag so a save from elsewhere (or a refresh) starts the editor from the new version */}
          <ShippingEditor key={data.settings.etag ?? "new"} projectId={project.id} initial={data.settings} regions={regions} />
          <ReturnPolicies projectId={project.id} policies={data.policies} />
          <RegionsCard projectId={project.id} regions={data.regions} inUse={regionsInUse(data.settings)} />
        </>
      )}
    </>
  );
}
