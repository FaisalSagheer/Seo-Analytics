import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { BusinessInfoCard, HomepageCard } from "@/components/shopping/account-settings";
import { requireProject } from "@/lib/session";
import { loadSettingsPage } from "@/lib/shopping";

export const metadata: Metadata = { title: "Business info" };

export default async function MerchantSettingsPage({ params }: PageProps<"/projects/[projectId]/shopping/settings">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Business info" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadSettingsPage(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && (
        <>
          <BusinessInfoCard key={JSON.stringify([data.accountName, data.info])} projectId={project.id} accountName={data.accountName} info={data.info} />
          <HomepageCard projectId={project.id} homepage={data.homepage} />
        </>
      )}
    </>
  );
}
