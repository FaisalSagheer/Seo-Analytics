import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { NoMerchant, ProblemAlert } from "@/components/shopping/merchant-states";
import { Notifications } from "@/components/shopping/notifications";
import { requireProject } from "@/lib/session";
import { loadNotifications } from "@/lib/shopping";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/projects/[projectId]/shopping/notifications">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const header = <PageHeader title="Notifications" />;
  if (project.isDemo || !project.merchantId) {
    return (
      <>
        {header}
        <NoMerchant project={project} />
      </>
    );
  }
  const { data, problem } = await loadNotifications(project);
  return (
    <>
      {header}
      {problem && <ProblemAlert problem={problem} projectId={project.id} />}
      {data && <Notifications notices={data} />}
    </>
  );
}
