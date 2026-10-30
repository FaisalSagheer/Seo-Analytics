import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { GooglePropertyForm } from "@/components/projects/google-property-form";
import { ProjectSettingsForm } from "@/components/projects/project-settings-form";
import { BacklinkSourcesForm } from "@/components/projects/backlink-sources-form";
import { getBingApiKey, getGoogleAccount, hasDataForSeo } from "@/lib/providers";
import { requirePermission, requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Project settings" };

export default async function ProjectSettingsPage({ params }: PageProps<"/projects/[projectId]/settings">) {
  const { projectId } = await params;
  await requirePermission("projects.edit");
  const { project } = await requireProject(projectId);
  // Syncs run on the owner's connected accounts, whoever is editing
  const [google, bingKey, dataForSeo] = await Promise.all([
    getGoogleAccount(project.userId),
    getBingApiKey(project.userId),
    hasDataForSeo(project.userId),
  ]);

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
            languageCode: project.languageCode,
            device: project.device,
          }}
        />
        <BacklinkSourcesForm
          isDemo={project.isDemo}
          dataForSeoConnected={dataForSeo}
          bingConnected={Boolean(bingKey)}
          initial={{
            projectId: project.id,
            backlinksDataForSeo: project.backlinksDataForSeo,
            backlinksBing: project.backlinksBing,
            bingSiteUrl: project.bingSiteUrl,
          }}
        />
        {!project.isDemo && (
          <GooglePropertyForm
            connected={Boolean(google?.hasDataScopes)}
            initial={{ projectId: project.id, gscSiteUrl: project.gscSiteUrl, ga4PropertyId: project.ga4PropertyId }}
          />
        )}
      </div>
    </>
  );
}
