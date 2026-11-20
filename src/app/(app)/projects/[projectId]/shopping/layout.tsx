import { AccountIssues } from "@/components/shopping/account-issues";
import { ShoppingTabs } from "@/components/shopping/shopping-tabs";
import { requireProject } from "@/lib/session";
import { loadAccountIssues } from "@/lib/shopping";

/** Tabs and account warnings for every Shopping page, once a Merchant Center account is set. */
export default async function ShoppingLayout({ children, params }: LayoutProps<"/projects/[projectId]/shopping">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  const ready = Boolean(project.merchantId) && !project.isDemo;
  const issues = ready ? await loadAccountIssues(project) : [];
  return (
    <>
      {ready && <ShoppingTabs projectId={project.id} />}
      <AccountIssues issues={issues} />
      {children}
    </>
  );
}
