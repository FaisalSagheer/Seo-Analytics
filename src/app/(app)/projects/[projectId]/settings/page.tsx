import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { GooglePropertyForm } from "@/components/projects/google-property-form";
import { ProjectAccessCard, type AccessRow } from "@/components/projects/project-access-card";
import { ProjectGoogleCard } from "@/components/projects/project-google-card";
import { ProjectGeminiCard } from "@/components/projects/project-gemini-card";
import { DeleteProjectCard, ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { GoogleCard } from "@/components/settings/google-card";
import { db } from "@/lib/db";
import { googleConfigured } from "@/lib/env";
import { getGoogleAccount, getGoogleSource } from "@/lib/providers";
import { can, getViewerRole, requirePermission, requireProject, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params, searchParams }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  const inUse = (await searchParams).google === "in-use";
  await requirePermission("projects.edit");
  const { project } = await requireProject(projectId);
  const user = await requireUser();
  const viewer = await getViewerRole();
  const [google, account, gemini, keywords, rankChecks, audits, gscDays, canGoogle] = await Promise.all([
    getGoogleSource(project),
    getGoogleAccount(user.id),
    db.projectCredential.findUnique({ where: { projectId_provider: { projectId, provider: "GEMINI" } }, select: { login: true } }),
    db.keyword.count({ where: { projectId } }),
    db.rankSnapshot.count({ where: { keyword: { projectId } } }),
    db.auditRun.count({ where: { projectId } }),
    db.searchConsoleDaily.count({ where: { projectId } }),
    can("google.edit"),
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
          initial={{
            name: project.name,
            domain: project.domain,
            locationCode: project.locationCode,
            device: project.device,
          }}
        />
        {canGoogle && (
          <div id="google-connection" className="scroll-mt-20">
            <GoogleCard
              configured={googleConfigured()}
              connected={Boolean(account?.hasDataScopes)}
              linked={Boolean(account)}
              inUse={inUse}
              redirectTo={`/projects/${project.id}/settings`}
            />
          </div>
        )}
        {!project.isDemo && (
          <GooglePropertyForm
            connected={google.source !== "none"}
            initial={{ projectId: project.id, gscSiteUrl: project.gscSiteUrl, ga4PropertyId: project.ga4PropertyId, merchantId: project.merchantId }}
          />
        )}
        {!project.isDemo && canGoogle && <ProjectGoogleCard projectId={project.id} source={google.source} email={google.email} />}
        <ProjectGeminiCard projectId={project.id} hint={gemini?.login ?? null} />
        {access && <ProjectAccessCard projectId={project.id} rows={access} />}
        <DeleteProjectCard projectId={project.id} name={project.name} domain={project.domain} counts={{ keywords, rankChecks, audits, gscDays }} />
      </div>
    </>
  );
}
