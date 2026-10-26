"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/lib/actions/projects";
import type { ProjectInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProjectFields } from "@/components/projects/project-fields";
import { Spinner } from "@/components/ui/spinner";

export function NewProjectDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProjectInput>({ name: "", domain: "", locationCode: 2840, languageCode: "en", device: "DESKTOP" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createProject(draft);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      router.push(`/projects/${res.data.id}/rankings`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New project
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>One project per domain. Rankings are checked in the market you pick.</DialogDescription>
          </DialogHeader>
          <ProjectFields draft={draft} onChange={setDraft} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
