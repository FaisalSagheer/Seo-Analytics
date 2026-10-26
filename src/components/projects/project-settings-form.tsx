"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteProject, updateProject } from "@/lib/actions/projects";
import type { ProjectInput } from "@/lib/validations";
import { ProjectFields } from "@/components/projects/project-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export function ProjectSettingsForm({ projectId, initial }: { projectId: string; initial: ProjectInput }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProjectInput>(initial);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProject(projectId, draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Project saved");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteProject(projectId);
      if (!res.ok) return void toast.error(res.error);
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

      <Card>
        <CardHeader>
          <CardTitle>Delete project</CardTitle>
          <CardDescription>Removes the project, its keywords and all ranking history. This can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>Delete project</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {initial.name}?</AlertDialogTitle>
                <AlertDialogDescription>All keywords, ranking history and synced data for {initial.domain} will be removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </>
  );
}
