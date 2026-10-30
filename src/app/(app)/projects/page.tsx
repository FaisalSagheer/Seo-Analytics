import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { DemoProjectButton } from "@/components/projects/demo-project-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatRelative } from "@/lib/format";
import { locationLabel } from "@/lib/markets";
import { listProjects } from "@/lib/queries";
import { can, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  await requireUser();
  const [projects, sp, canCreate] = await Promise.all([listProjects(), searchParams, can("projects.create")]);
  const openNew = sp.new === "1" && canCreate;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project tracks one domain: rankings, search performance, backlinks."
        actions={
          canCreate && (
            <>
              <DemoProjectButton />
              <NewProjectDialog defaultOpen={openNew} />
            </>
          )
        }
      />

      {projects.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlusIcon />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              {canCreate
                ? "Create a project for your domain, or load a demo project with six months of sample data to look around first."
                : "Your team hasn't created any projects yet. Ask an admin or editor to add one."}
            </EmptyDescription>
          </EmptyHeader>
          {canCreate && (
            <EmptyContent className="flex-row justify-center">
              <DemoProjectButton variant="default" />
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group rounded-xl focus-visible:outline-2">
              <Card className="group-hover:ring-primary/40 h-full transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="truncate">{p.name}</span>
                    {p.isDemo && <Badge variant="secondary">Demo</Badge>}
                  </CardTitle>
                  <CardDescription className="truncate">{p.domain}</CardDescription>
                </CardHeader>
                <CardFooter className="text-muted-foreground mt-auto flex justify-between text-xs">
                  <span>
                    {p._count.keywords} keywords · {locationLabel(p.locationCode)}
                  </span>
                  <span>Synced {formatRelative(p.lastSyncedAt)}</span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
