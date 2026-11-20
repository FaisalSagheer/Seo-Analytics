import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { AccountIssueList } from "@/components/shopping/account-issues";
import { NoMerchant } from "@/components/shopping/merchant-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProject } from "@/lib/session";
import { loadAccountIssues } from "@/lib/shopping";

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
  const issues = await loadAccountIssues(project);
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <a href={`/projects/${project.id}/shopping/mc/notifications`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ExternalLinkIcon data-icon="inline-start" />
            Open in Merchant Center
          </a>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Account issues</CardTitle>
          <CardDescription>What Merchant Center says needs attention on this account. Product issues are on Products.</CardDescription>
        </CardHeader>
        <CardContent>
          <AccountIssueList issues={issues} />
        </CardContent>
      </Card>
    </>
  );
}
