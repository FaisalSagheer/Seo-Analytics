"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import type { ProjectInput } from "@/lib/validations";
import { useCan } from "@/components/permissions-provider";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ProjectFields } from "@/components/projects/project-fields";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export type ProjectCounts = { keywords: number; rankChecks: number; audits: number; gscDays: number };

export function ProjectSettingsForm({ projectId, initial, counts }: { projectId: string; initial: ProjectInput; counts: ProjectCounts }) {
  const router = useRouter();
  const canDelete = useCan("projects.delete");
  const [draft, setDraft] = useState<ProjectInput>(initial);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProject(projectId, draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Project saved");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteProject(projectId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Deleted ${initial.name}`);
      router.push("/projects");
    });
  }

  return (
    <>
      <Card>
        <form onSubmit={save}>
          <CardHeader>
            <CardTitle>Project</CardTitle>
            <CardDescription>Changing the market affects new rank checks only; history is kept.</CardDescription>
          </CardHeader>
          <CardContent className="py-6">
            <ProjectFields draft={draft} onChange={setDraft} />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      {canDelete && (
      <Card>
        <CardHeader>
          <CardTitle>Delete project</CardTitle>
          <CardDescription>Removes the project, its keywords and all ranking history. This can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardFooter>
          <ConfirmDelete
            triggerRender={<Button variant="destructive" />}
            title={`Delete ${initial.name}?`}
            description="This permanently deletes the project and everything stored for it. It can't be undone."
            details={[
              { label: "Project", value: initial.name },
              { label: "Domain", value: initial.domain },
              { label: "Tracked keywords", value: formatNumber(counts.keywords) },
              { label: "Ranking checks", value: formatNumber(counts.rankChecks) },
              { label: "Search Console days", value: formatNumber(counts.gscDays) },
              { label: "Site audits", value: formatNumber(counts.audits) },
            ]}
            note="Your Google connection and the client's service account in other projects are not affected."
            confirmLabel="Delete project"
            onConfirm={remove}
          >
            Delete project
          </ConfirmDelete>
        </CardFooter>
      </Card>
      )}
    </>
  );
}
