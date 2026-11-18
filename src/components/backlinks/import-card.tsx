"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLinkIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { importLinks } from "@/lib/actions/links";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function LinkImportCard({ projectId, domain, today }: { projectId: string; domain: string; today: string }) {
  const allowed = useCan("data.sync");
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [names, setNames] = useState<string[]>([]);
  if (!allowed) return null;

  const searchConsole = `https://search.google.com/search-console/links?resource_id=${encodeURIComponent(`sc-domain:${domain}`)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Search Console</CardTitle>
        <CardDescription>
          Google has no API for links. In Search Console open Links, press Export external links, and choose Download CSV or Excel. Upload the ZIP (or the CSV files) here. Import again every month or so to see what changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={form}
          className="flex flex-wrap items-end gap-3"
          action={(fd) =>
            startTransition(async () => {
              fd.set("projectId", projectId);
              const res = await importLinks(fd);
              if (!res.ok) return void toast.error(res.error);
              const parts = res.data.imported.map((i) => `${i.rows} ${i.label.toLowerCase()}`).join(", ");
              toast.success(`Imported ${parts}`);
              res.data.skipped.forEach((s) => toast.warning(`${s.fileName}: ${s.reason}`));
              form.current?.reset();
              setNames([]);
            })
          }
        >
          <div className="grid gap-1.5">
            <Label htmlFor="links-files">ZIP or CSV files</Label>
            <Input
              id="links-files"
              name="files"
              type="file"
              multiple
              accept=".zip,.csv,text/csv,application/zip"
              required
              onChange={(e) => setNames(Array.from(e.target.files ?? []).map((f) => f.name))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="links-asof">Exported on</Label>
            <Input id="links-asof" name="asOf" type="date" defaultValue={today} max={today} required />
          </div>
          <Button type="submit" disabled={pending || names.length === 0}>
            {pending ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
            {pending ? "Importing…" : "Import"}
          </Button>
          <a href={searchConsole} target="_blank" rel="noreferrer noopener" className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
            Open Search Console links <ExternalLinkIcon className="size-3" />
          </a>
        </form>
      </CardContent>
    </Card>
  );
}
