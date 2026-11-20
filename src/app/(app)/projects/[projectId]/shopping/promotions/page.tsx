import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Promotions } from "@/components/shopping/promotions";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireProject } from "@/lib/session";
import { loadPromotions } from "@/lib/shopping";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage({ params }: PageProps<"/projects/[projectId]/shopping/promotions">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Promotions" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem, unavailable } = await loadPromotions(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {unavailable && (
        <Alert>
          <AlertTitle>Promotions aren&apos;t turned on for this account</AlertTitle>
          <AlertDescription>
            Google only offers promotions in some countries, and the store has to join first: in Merchant Center, open Marketing → Promotions and sign up. If that page
            isn&apos;t there, promotions aren&apos;t available for the store&apos;s country yet. Google said: {unavailable}
          </AlertDescription>
        </Alert>
      )}
      {data && <Promotions projectId={project.id} promotions={data} />}
    </>
  );
}
