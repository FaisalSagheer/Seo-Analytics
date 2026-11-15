import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { GooglePropertyForm } from "@/components/projects/google-property-form";
import { ProjectGoogleCard } from "@/components/projects/project-google-card";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { db } from "@/lib/db";
import { getGoogleSource } from "@/lib/providers";
import { can, requirePermission, requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  await requirePermission("projects.edit");
  const { project } = await requireProject(projectId);
  const [google, keywords, rankChecks, audits, gscDays, canGoogle] = await Promise.all([
    getGoogleSource(project),
    db.keyword.count({ where: { projectId } }),
    db.rankSnapshot.count({ where: { keyword: { projectId } } }),
    db.auditRun.count({ where: { projectId } }),
    db.searchConsoleDaily.count({ where: { projectId } }),
    can("providers.manage"),
  ]);

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
