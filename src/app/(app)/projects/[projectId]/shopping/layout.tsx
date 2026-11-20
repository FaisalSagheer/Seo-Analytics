import { AccountIssues } from "@/components/shopping/account-issues";
import { requireProject } from "@/lib/session";
import { loadAccountIssues } from "@/lib/shopping";

/** Account warnings for every Shopping page (navigation is in the sidebar), once a Merchant Center account is set. */
export default async function ShoppingLayout({ children, params }: LayoutProps<"/projects/[projectId]/shopping">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const ready = Boolean(project.merchantId) && !project.isDemo;
  const issues = ready ? await loadAccountIssues(project) : [];
  return (
    <>
      <AccountIssues issues={issues} />
      {children}
    </>
  );
}
