import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { GooglePropertyForm } from "@/components/projects/google-property-form";
import { ProjectAccessCard, type AccessRow } from "@/components/projects/project-access-card";
import { ProjectGoogleCard } from "@/components/projects/project-google-card";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { db } from "@/lib/db";
import { getGoogleSource } from "@/lib/providers";
import { can, getViewerRole, requirePermission, requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  await requirePermission("projects.edit");
  const { project } = await requireProject(projectId);
  const viewer = await getViewerRole();
  const [google, keywords, rankChecks, audits, gscDays, canGoogle] = await Promise.all([
    getGoogleSource(project),
    db.keyword.count({ where: { projectId } }),
    db.rankSnapshot.count({ where: { keyword: { projectId } } }),
    db.auditRun.count({ where: { projectId } }),
    db.searchConsoleDaily.count({ where: { projectId } }),
    can("providers.manage"),
  ]);

  let access: AccessRow[] | null = null;
  if (viewer.isAdmin && !project.isDemo) {
    const [users, roles, members] = await Promise.all([
      db.user.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, roleId: true, role: { select: { name: true, seeAllProjects: true, isSystem: true } } } }),
      db.role.findFirst({ where: { isDefault: true }, select: { name: true, seeAllProjects: true, isSystem: true } }),
      db.projectMember.findMany({ where: { projectId }, select: { userId: true } }),
    ]);
    const memberIds = new Set(members.map((m) => m.userId));
    access = users.map((u) => {
      // A user with no role row gets the default role, so judge them by that
      const role = u.role ?? roles;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        roleName: role?.name ?? "No role",
        seesAll: Boolean(role?.isSystem || role?.seeAllProjects),
        hasAccess: memberIds.has(u.id),
      };
    });
  }

  return (
    <>
      <PageHeader title="Project settings" description={project.domain} />
      <div className="flex max-w-3xl flex-col gap-6">
        <ProjectSettingsForm
          projectId={project.id}
          counts={{ keywords, rankChecks, audits, gscDays }}
          initial={{
            name: project.name,
            domain: project.domain,
            locationCode: project.locationCode,
            languageCode: project.languageCode,
            device: project.device,
          }}
        />
        {access && <ProjectAccessCard projectId={project.id} rows={access} />}
        {!project.isDemo && canGoogle && <ProjectGoogleCard projectId={project.id} source={google.source} email={google.email} />}
        {!project.isDemo && (
          <GooglePropertyForm
            connected={google.source !== "none"}
            initial={{ projectId: project.id, gscSiteUrl: project.gscSiteUrl, ga4PropertyId: project.ga4PropertyId }}
          />
        )}
      </div>
    </>
  );
}
