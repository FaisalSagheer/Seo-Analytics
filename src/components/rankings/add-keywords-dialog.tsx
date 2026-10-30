"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { addKeywords, runSync } from "@/lib/actions/projects";
import type { AddKeywordsInput } from "@/lib/validations";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useCan } from "@/components/permissions-provider";
import { Textarea } from "@/components/ui/textarea";

export function AddKeywordsDialog({ projectId }: { projectId: string }) {
  const allowed = useCan("keywords.manage");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<AddKeywordsInput>({ projectId, phrases: "", tags: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addKeywords(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data.added} keyword${res.data.added === 1 ? "" : "s"} added. Checking positions…`);
      setOpen(false);
      setDraft({ projectId, phrases: "", tags: "" });
      router.refresh();
      // First check right away so the table isn't empty until the next cron
      const sync = await runSync(projectId, ["rankings"]);
      if (sync.ok && sync.data.rankings && !sync.data.rankings.ok) toast.error(sync.data.rankings.message);
      router.refresh();
    });
  }

  if (!allowed) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon data-icon="inline-start" />
        Add keywords
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Track keywords</DialogTitle>
            <DialogDescription>Positions are checked daily in the project&apos;s market, top 100 results.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="kw-phrases">Keywords</FieldLabel>
              <Textarea
                id="kw-phrases"
                rows={8}
                required
                placeholder={"rank tracker\nseo dashboard"}
                value={draft.phrases}
                onChange={(e) => setDraft({ ...draft, phrases: e.target.value })}
              />
              <FieldDescription>One per line, up to 500. Duplicates are skipped.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="kw-tags">Tags</FieldLabel>
              <Input
                id="kw-tags"
                placeholder="brand, blog"
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
              />
              <FieldDescription>Comma-separated. Used to filter the rankings table.</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Add and check
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
