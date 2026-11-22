"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addRegion, editRegion, removeRegion, type RegionInput } from "@/lib/actions/merchant";
import type { Region } from "@/lib/merchant-shipping";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { F, Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const idOf = (r: Region) => r.name?.split("/").pop() ?? "";
const typeOf = (r: Region) => (r.postalCodeArea ? "Postal codes" : r.geotargetArea ? "Geotargets" : r.radiusArea ? "Radius" : "—");

type Draft = { id: string; displayName: string; kind: "postal" | "geo"; regionCode: string; ranges: string; geo: string };

const toDraft = (r?: Region): Draft => ({
  id: r ? idOf(r) : "",
  displayName: r?.displayName ?? "",
  kind: r?.geotargetArea ? "geo" : "postal",
  regionCode: r?.postalCodeArea?.regionCode ?? "",
  ranges: (r?.postalCodeArea?.postalCodes ?? []).map((p) => (p.end ? `${p.begin}-${p.end}` : (p.begin ?? ""))).join("\n"),
  geo: (r?.geotargetArea?.geotargetCriteriaIds ?? []).join(", "),
});

const toInput = (d: Draft): RegionInput => ({
  displayName: d.displayName,
  kind: d.kind,
  regionCode: d.regionCode,
  // One per line: "54000" or a range "54000-54999" (wildcards like "540*" are passed through)
  ranges: d.ranges
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [begin, end] = l.split(/\s*-\s*/);
      return { begin, end };
    }),
  geotargetIds: d.geo.split(",").map((s) => s.trim()).filter(Boolean),
});

/** Regions: postal-code or geotarget areas that rate tables and transit tables refer to. */
export function RegionsCard({ projectId, regions, inUse }: { projectId: string; regions: Region[]; inUse: string[] }) {
  const canCreate = useCan("shipping.create");
  const canEdit = useCan("shipping.edit");
  const canDelete = useCan("shipping.delete");
  const hasActions = canEdit || canDelete;
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ name?: string; draft: Draft } | null>(null);

  function save() {
    if (!editing) return;
    const { name, draft } = editing;
    startTransition(async () => {
      const res = name ? await editRegion(projectId, name, toInput(draft)) : await addRegion(projectId, draft.id.trim(), toInput(draft));
      if (!res.ok) return void toast.error(res.error);
      toast.success(name ? "Region updated." : "Region added.");
      setEditing(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regions</CardTitle>
        <CardDescription>Areas defined by postal codes or Google geotargets, used by rate tables and transit-time tables.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {regions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No regions yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Region</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Shipping</TableHead>
                {hasActions && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {regions.map((r) => (
                <TableRow key={r.name}>
                  <TableCell>
                    <span className="font-medium">{r.displayName || idOf(r)}</span>
                    <span className="text-muted-foreground block text-xs">{idOf(r)}</span>
                  </TableCell>
                  <TableCell>{typeOf(r)}</TableCell>
                  <TableCell>{r.shippingEligible === false ? <Badge variant="outline">Not eligible</Badge> : <Badge variant="secondary">Eligible</Badge>}</TableCell>
                  {hasActions && (
                    <TableCell className="text-right">
                      {canEdit && !r.radiusArea && (
                        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.displayName || idOf(r)}`} onClick={() => setEditing({ name: r.name, draft: toDraft(r) })}>
                          <PencilIcon />
                        </Button>
                      )}
                      {canDelete && (
<ConfirmDelete
                        triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.displayName || idOf(r)}`} disabled={pending} />}
                        title={`Delete region "${r.displayName || idOf(r)}"?`}
                        description={
                          inUse.includes(idOf(r))
                            ? "Your shipping settings use this region in a table. Remove it there first, or saving shipping will fail."
                            : "It's removed from Merchant Center."
                        }
                        details={[
                          { label: "Region", value: idOf(r) },
                          { label: "Type", value: typeOf(r) },
                        ]}
                        onConfirm={() =>
                          startTransition(async () => {
                            const res = await removeRegion(projectId, r.name!);
                            if (!res.ok) return void toast.error(res.error);
                            toast.success("Region deleted.");
                          })
                        }
                      >
                        <Trash2Icon />
                      </ConfirmDelete>
)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {canCreate && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing({ draft: toDraft() })}>
            <PlusIcon data-icon="inline-start" />
            Add region
          </Button>
        )}
      </CardContent>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.name ? "Edit region" : "Add region"}</DialogTitle>
                <DialogDescription>Define the area by postal codes in one country, or by Google geotarget IDs.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {!editing.name && (
                  <F label="Region ID (used in tables)">
                    <Input aria-label="Region ID" placeholder="e.g. lahore-city" value={editing.draft.id} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, id: e.target.value } })} />
                  </F>
                )}
                <F label="Name">
                  <Input aria-label="Region name" value={editing.draft.displayName} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, displayName: e.target.value } })} />
                </F>
                <F label="Defined by">
                  <Pick
                    label="Region type"
                    value={editing.draft.kind}
                    options={[
                      { value: "postal", label: "Postal codes" },
                      { value: "geo", label: "Google geotarget IDs" },
                    ]}
                    onChange={(kind) => setEditing({ ...editing, draft: { ...editing.draft, kind } })}
                  />
                </F>
                {editing.draft.kind === "postal" ? (
                  <>
                    <F label="Country (2 letters)">
                      <Input aria-label="Region country" maxLength={2} value={editing.draft.regionCode} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, regionCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") } })} />
                    </F>
                    <F label="Postal codes, one per line (a code, a range like 54000-54999, or a prefix like 540*)">
                      <Textarea aria-label="Postal codes" rows={5} value={editing.draft.ranges} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, ranges: e.target.value } })} />
                    </F>
                  </>
                ) : (
                  <F label="Geotarget IDs, comma separated">
                    <Input aria-label="Geotarget IDs" placeholder="e.g. 1011085, 1011086" value={editing.draft.geo} onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, geo: e.target.value } })} />
                  </F>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Save region
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
