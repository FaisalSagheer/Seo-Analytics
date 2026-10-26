import type { Metadata } from "next";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { PageHeader } from "@/components/dashboard/page-header";
import { KeywordIdeas } from "@/components/research/keyword-ideas";
import { locationLabel } from "@/lib/markets";
import { requireProject } from "@/lib/session";

export const metadata: Metadata = { title: "Keyword research" };

export default async function KeywordsPage({ params }: PageProps<"/projects/[projectId]/keywords">) {
  const { projectId } = await params;
  const { project } = await requireProject(projectId);
  return (
    <>
      <PageHeader title="Keyword research" description={`Ideas for ${locationLabel(project.locationCode)}, ${project.languageCode}.`} />
      {project.isDemo && <DemoAlert />}
      <KeywordIdeas projectId={project.id} locationCode={project.locationCode} languageCode={project.languageCode} />
    </>
  );
}
