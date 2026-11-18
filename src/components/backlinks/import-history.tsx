"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteLinkImport } from "@/lib/actions/links";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";

type Row = { id: string; asOf: string; counts: Record<"SITE" | "PAGE" | "TEXT", number> };

export function LinkImportHistory({ projectId, imports }: { projectId: string; imports: Row[] }) {
  const allowed = useCan("data.sync");
  const [pending, startTransition] = useTransition();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Exported</TableHead>
          <TableHead className="text-right">Linking sites</TableHead>
          <TableHead className="text-right">Linked pages</TableHead>
          <TableHead className="text-right">Link texts</TableHead>
          {allowed && <TableHead className="w-12" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {imports.map((i) => (
          <TableRow key={i.id}>
            <TableCell>{formatDate(i.asOf, "long")}</TableCell>
            <TableCell className="text-right tabular-nums">{i.counts.SITE ? formatNumber(i.counts.SITE) : "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{i.counts.PAGE ? formatNumber(i.counts.PAGE) : "—"}</TableCell>
            <TableCell className="text-right tabular-nums">{i.counts.TEXT ? formatNumber(i.counts.TEXT) : "—"}</TableCell>
            {allowed && (
              <TableCell>
                <ConfirmDelete
                  triggerRender={<Button variant="ghost" size="icon-sm" aria-label={`Delete the ${i.asOf} import`} disabled={pending} />}
                  title="Delete this import?"
                  description="The uploaded link lists are removed from this project. Changes shown on the page are worked out again from the imports that remain."
                  details={[
                    { label: "Exported", value: formatDate(i.asOf, "long") },
                    { label: "Linking sites", value: formatNumber(i.counts.SITE) },
                    { label: "Linked pages", value: formatNumber(i.counts.PAGE) },
                  ]}
                  onConfirm={() =>
                    startTransition(async () => {
                      const res = await deleteLinkImport(projectId, i.id);
                      if (!res.ok) return void toast.error(res.error);
                      toast.success("Import deleted");
                    })
                  }
                >
                  <Trash2Icon />
                </ConfirmDelete>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
