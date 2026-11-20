"use client";

import { ExternalLinkIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addMerchantUser,
  changeMerchantUser,
  removeMerchantUser,
  saveBusinessInfo,
  saveHomepage,
  setHomepageClaim,
  toggleProgram,
  type BusinessInfoInput,
} from "@/lib/actions/merchant";
import type { AccessRight, BusinessInfoDoc, HomepageDoc, ProgramDoc, UserDoc } from "@/lib/providers/google";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { F } from "@/components/shopping/fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Done = { ok: true } | { ok: false; error: string };

/** Runs a write in a transition and toasts the result. */
function useWrite() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Done>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      after?.();
    });
  return [pending, run] as const;
}

const httpsOnly = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);

// ---- business info

const toInput = (name: string, i: BusinessInfoDoc): BusinessInfoInput => ({
  name,
  previousName: name,
  address: {
    addressLines: i.address?.addressLines ?? [],
    locality: i.address?.locality ?? "",
    administrativeArea: i.address?.administrativeArea ?? "",
    postalCode: i.address?.postalCode ?? "",
    regionCode: i.address?.regionCode ?? "",
  },
  customerService: { email: i.customerService?.email ?? "", uri: i.customerService?.uri ?? "", phone: i.customerService?.phone?.e164Number ?? "" },
});

export function BusinessInfoCard({ projectId, accountName, info }: { projectId: string; accountName: string; info: BusinessInfoDoc }) {
  const canEdit = useCan("merchant.manage");
  const [saved] = useState(() => toInput(accountName, info));
  const [v, setV] = useState(saved);
  const [pending, run] = useWrite();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  const a = v.address;
  const setA = (p: Partial<BusinessInfoInput["address"]>) => setV({ ...v, address: { ...a, ...p } });
  const cs = v.customerService;
  const setCs = (p: Partial<BusinessInfoInput["customerService"]>) => setV({ ...v, customerService: { ...cs, ...p } });
  const verified = info.phoneVerificationState === "PHONE_VERIFICATION_STATE_VERIFIED";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business information</CardTitle>
        <CardDescription>Shown to shoppers and used by Google to verify the store.</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset disabled={!canEdit || pending} className="grid gap-3 sm:grid-cols-2">
          <F label="Business name" className="sm:col-span-2">
            <Input aria-label="Business name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </F>
          <F label="Street address (one line each)" className="sm:col-span-2">
            <Textarea aria-label="Street address" rows={2} value={a.addressLines.join("\n")} onChange={(e) => setA({ addressLines: e.target.value.split("\n") })} />
          </F>
          <F label="City">
            <Input aria-label="Business city" value={a.locality} onChange={(e) => setA({ locality: e.target.value })} />
          </F>
          <F label="State / province">
            <Input aria-label="Business state" value={a.administrativeArea} onChange={(e) => setA({ administrativeArea: e.target.value })} />
          </F>
          <F label="Postal code">
            <Input aria-label="Business postal code" value={a.postalCode} onChange={(e) => setA({ postalCode: e.target.value })} />
          </F>
          <F label="Country (2 letters)">
            <Input aria-label="Business country" maxLength={2} value={a.regionCode} onChange={(e) => setA({ regionCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
          </F>
          <F label="Business phone">
            <p className="text-sm">
              {info.phone?.e164Number ?? "Not set"}{" "}
              {info.phone?.e164Number && <Badge variant={verified ? "secondary" : "outline"}>{verified ? "Verified" : "Not verified"}</Badge>}
            </p>
            <p className="text-muted-foreground text-xs">Google verifies this number in Merchant Center, so it can&apos;t be changed here.</p>
          </F>
          <div />
          <F label="Customer service email">
            <Input aria-label="Customer service email" type="email" value={cs.email} onChange={(e) => setCs({ email: e.target.value })} />
          </F>
          <F label="Customer service phone (e.g. +924211234567)">
            <Input aria-label="Customer service phone" value={cs.phone} onChange={(e) => setCs({ phone: e.target.value })} />
          </F>
          <F label="Customer service page" className="sm:col-span-2">
            <Input aria-label="Customer service URL" placeholder="https://…" value={cs.uri} onChange={(e) => setCs({ uri: e.target.value })} />
          </F>
        </fieldset>
        {canEdit && (
          <div className="mt-4 flex gap-2">
            <Button disabled={pending || !dirty} onClick={() => run(() => saveBusinessInfo(projectId, v), "Business information saved.")}>
              {pending && <Spinner data-icon="inline-start" />}
              Save business information
            </Button>
            <Button variant="ghost" disabled={pending || !dirty} onClick={() => setV(saved)}>
              Discard changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- homepage

export function HomepageCard({ projectId, homepage }: { projectId: string; homepage: HomepageDoc }) {
  const canEdit = useCan("merchant.manage");
  const [uri, setUri] = useState(homepage.uri ?? "");
  const [pending, run] = useWrite();
  const [taken, setTaken] = useState(false);

  function claim(overwrite: boolean) {
    run(
      async () => {
        const res = await setHomepageClaim(projectId, true, overwrite);
        // Another account holds the claim: offer to take it over
        if (!res.ok && !overwrite && /already claimed|another account|overwrite/i.test(res.error)) setTaken(true);
        return res;
      },
      "Homepage claimed.",
      () => setTaken(false),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store homepage</CardTitle>
        <CardDescription>The store&apos;s website. Products can only show on Google once it&apos;s claimed (verified as yours).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {homepage.uri ? (
            <a href={httpsOnly(homepage.uri) ?? undefined} target="_blank" rel="noreferrer" className="font-medium underline-offset-4 hover:underline">
              {homepage.uri}
            </a>
          ) : (
            <span className="text-muted-foreground">No homepage set.</span>
          )}
          {homepage.uri && <Badge variant={homepage.claimed ? "secondary" : "outline"}>{homepage.claimed ? "Claimed" : "Not claimed"}</Badge>}
        </div>
        {canEdit && (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <F label="Homepage URL" className="w-full sm:w-96">
                <Input aria-label="Homepage URL" placeholder="https://example.com" value={uri} disabled={pending} onChange={(e) => setUri(e.target.value)} />
              </F>
              <Button variant="outline" disabled={pending || !uri.trim() || uri.trim() === homepage.uri} onClick={() => run(() => saveHomepage(projectId, uri), "Homepage saved.")}>
                Save URL
              </Button>
              {homepage.uri && !homepage.claimed && (
                <Button disabled={pending} onClick={() => claim(false)}>
                  {pending && <Spinner data-icon="inline-start" />}
                  Claim homepage
                </Button>
              )}
              {homepage.claimed && (
                <ConfirmDelete
                  triggerRender={<Button variant="ghost" disabled={pending} />}
                  title="Release the homepage claim?"
                  description="Products stop showing on Google until the homepage is claimed again."
                  details={[{ label: "Homepage", value: homepage.uri }]}
                  confirmLabel="Release claim"
                  onConfirm={() => run(() => setHomepageClaim(projectId, false), "Homepage claim released.")}
                >
                  Release claim
                </ConfirmDelete>
              )}
            </div>
            {uri.trim() !== (homepage.uri ?? "") && homepage.claimed && <p className="text-muted-foreground text-xs">Changing the URL removes the claim; claim it again afterwards.</p>}
            {taken && (
              <Alert>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  Another Merchant Center account has claimed this website.
                  <ConfirmDelete
                    triggerRender={<Button size="sm" variant="outline" disabled={pending} />}
                    title="Take over the claim?"
                    description="The other account loses the claim and its products stop showing on Google."
                    details={[{ label: "Homepage", value: homepage.uri }]}
                    confirmLabel="Take over"
                    onConfirm={() => claim(true)}
                  >
                    Take over the claim
                  </ConfirmDelete>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---- programs

const PROGRAM_LABEL: Record<string, string> = {
  "free-listings": "Free listings",
  "shopping-ads": "Shopping ads",
  "free-local-listings": "Free local listings",
  "local-inventory-ads": "Local inventory ads",
  "youtube-shopping-checkout": "YouTube Shopping checkout",
  checkout: "Checkout on Google",
};
const programLabel = (p: ProgramDoc) => {
  const id = p.name?.split("/").pop() ?? "";
  return PROGRAM_LABEL[id] ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
};
const STATE: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  ENABLED: { label: "On", variant: "secondary" },
  ELIGIBLE: { label: "Off · eligible", variant: "outline" },
  NOT_ELIGIBLE: { label: "Not eligible", variant: "destructive" },
};

export function ProgramsCard({ projectId, programs }: { projectId: string; programs: ProgramDoc[] }) {
  const canEdit = useCan("merchant.manage");
  const [pending, run] = useWrite();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Programs</CardTitle>
        <CardDescription>Where the products can show on Google, and what each program still needs.</CardDescription>
      </CardHeader>
      <CardContent>
        {programs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No programs reported for this account.</p>
        ) : (
          <ul className="divide-y">
            {programs.map((p) => {
              const st = STATE[p.state ?? ""] ?? { label: "Unknown", variant: "outline" as const };
              return (
                <li key={p.name} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{programLabel(p)}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {httpsOnly(p.documentationUri) && (
                        <a href={httpsOnly(p.documentationUri)} target="_blank" rel="noreferrer" aria-label={`About ${programLabel(p)}`} className="text-muted-foreground hover:text-foreground">
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                      )}
                    </div>
                    {(p.activeRegionCodes ?? []).length > 0 && <span className="text-muted-foreground text-xs">Active in {p.activeRegionCodes!.join(", ")}</span>}
                    {(p.unmetRequirements ?? []).map((r, i) => (
                      <span key={i} className="text-muted-foreground text-xs">
                        Needs: {httpsOnly(r.documentationUri) ? <a href={httpsOnly(r.documentationUri)} target="_blank" rel="noreferrer" className="underline underline-offset-2">{r.title}</a> : r.title}
                        {(r.affectedRegionCodes ?? []).length > 0 && ` (${r.affectedRegionCodes!.join(", ")})`}
                      </span>
                    ))}
                  </div>
                  {canEdit && p.state === "ELIGIBLE" && (
                    <Button size="sm" disabled={pending} onClick={() => run(() => toggleProgram(projectId, p.name!, true), `${programLabel(p)} turned on.`)}>
                      Turn on
                    </Button>
                  )}
                  {canEdit && p.state === "ENABLED" && (
                    <ConfirmDelete
                      triggerRender={<Button size="sm" variant="outline" disabled={pending} />}
                      title={`Turn off ${programLabel(p)}?`}
                      description="Products stop showing on Google through this program until it's turned on again."
                      details={[{ label: "Program", value: programLabel(p) }]}
                      confirmLabel="Turn off"
                      onConfirm={() => run(() => toggleProgram(projectId, p.name!, false), `${programLabel(p)} turned off.`)}
                    >
                      Turn off
                    </ConfirmDelete>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---- people and access

const RIGHTS: { value: AccessRight; label: string; hint: string }[] = [
  { value: "ADMIN", label: "Admin", hint: "everything, including people and access" },
  { value: "STANDARD", label: "Standard", hint: "edit products and settings" },
  { value: "READ_ONLY", label: "Read only", hint: "view only" },
  { value: "PERFORMANCE_REPORTING", label: "Performance and insights", hint: "reports" },
  { value: "API_DEVELOPER", label: "API developer", hint: "Merchant API and notifications" },
];
const rightsLabel = (r?: AccessRight[]) => (r ?? []).map((x) => RIGHTS.find((o) => o.value === x)?.label ?? x).join(", ") || "—";
const emailOf = (u: UserDoc) => u.name?.split("/").pop() ?? "";

function RightsPicker({ value, onChange }: { value: AccessRight[]; onChange: (r: AccessRight[]) => void }) {
  return (
    <div role="group" aria-label="Access rights" className="flex flex-col gap-2">
      {RIGHTS.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm">
          <Checkbox aria-label={o.label} checked={value.includes(o.value)} onCheckedChange={(c) => onChange(c === true ? [...value, o.value] : value.filter((x) => x !== o.value))} />
          {o.label}
          <span className="text-muted-foreground text-xs">{o.hint}</span>
        </label>
      ))}
    </div>
  );
}

export function PeopleCard({ projectId, users }: { projectId: string; users: UserDoc[] | null }) {
  const canEdit = useCan("merchant.manage");
  const [pending, run] = useWrite();
  const [editing, setEditing] = useState<{ name?: string; email: string; rights: AccessRight[] } | null>(null);
  const admins = (users ?? []).filter((u) => u.accessRights?.includes("ADMIN")).length;

  function save() {
    if (!editing) return;
    const { name, email, rights } = editing;
    run(() => (name ? changeMerchantUser(projectId, name, rights) : addMerchantUser(projectId, email, rights)), name ? "Access updated." : "Invitation sent.", () => setEditing(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>People and access</CardTitle>
        <CardDescription>Who can use this Merchant Center account. New people get an email invitation.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {users == null ? (
          <p className="text-muted-foreground text-sm">Seeing people and access needs Admin access to the Merchant Center account.</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-sm">No people listed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const lastAdmin = admins <= 1 && u.accessRights?.includes("ADMIN");
                return (
                  <TableRow key={u.name}>
                    <TableCell className="font-medium">{emailOf(u)}</TableCell>
                    <TableCell>{rightsLabel(u.accessRights)}</TableCell>
                    <TableCell>{u.state === "PENDING" ? <Badge variant="outline">Invited</Badge> : <Badge variant="secondary">Active</Badge>}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button size="icon-sm" variant="ghost" aria-label={`Change access for ${emailOf(u)}`} onClick={() => setEditing({ name: u.name, email: emailOf(u), rights: u.accessRights ?? [] })}>
                          <PencilIcon />
                        </Button>
                        <ConfirmDelete
                          triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Remove ${emailOf(u)}`} disabled={pending || lastAdmin} />}
                          title={`Remove ${emailOf(u)}?`}
                          description="They lose access to this Merchant Center account."
                          details={[
                            { label: "Email", value: emailOf(u) },
                            { label: "Access", value: rightsLabel(u.accessRights) },
                          ]}
                          confirmLabel="Remove"
                          onConfirm={() => run(() => removeMerchantUser(projectId, u.name!), "Person removed.")}
                        >
                          <Trash2Icon />
                        </ConfirmDelete>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {canEdit && users != null && (
          <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing({ email: "", rights: ["STANDARD"] })}>
            <PlusIcon data-icon="inline-start" />
            Add person
          </Button>
        )}
      </CardContent>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.name ? `Access for ${editing.email}` : "Add person"}</DialogTitle>
                <DialogDescription>{editing.name ? "Choose what they can do." : "They get an email invitation to this Merchant Center account."}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                {!editing.name && (
                  <F label="Email">
                    <Input aria-label="Person email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
                  </F>
                )}
                <RightsPicker value={editing.rights} onChange={(rights) => setEditing({ ...editing, rights })} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={pending || editing.rights.length === 0 || (!editing.name && !editing.email.trim())}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {editing.name ? "Save access" : "Send invitation"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
