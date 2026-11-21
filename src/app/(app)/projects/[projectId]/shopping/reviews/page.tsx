import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { Reviews } from "@/components/shopping/reviews";
import {
  NoMerchant,
  ProblemAlert,
} from "@/components/shopping/merchant-states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireProject } from "@/lib/session";
import { loadReviews } from "@/lib/shopping";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({
  params,
}: PageProps<"/projects/[projectId]/shopping/reviews">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Reviews" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem, unavailable } = await loadReviews(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {unavailable && (
        <Alert>
          <AlertTitle>
            Product ratings aren&apos;t turned on for this store
          </AlertTitle>
          <AlertDescription>
            Reviews show here once the store is in Google&apos;s product ratings
            program and a review provider sends them. Turn it on under Marketing
            → Marketing methods → Product ratings, or in Merchant Center.
          </AlertDescription>
        </Alert>
      )}
      {data && <Reviews projectId={project.id} reviews={data} />}
    </>
  );
}
