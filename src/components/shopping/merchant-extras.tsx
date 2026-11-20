"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addConversionSource,
  decideServiceLink,
  linkBusinessProfile,
  removeConversionSource,
  saveAutomaticImprovements,
  updateConversionAttribution,
  type ImprovementSettings,
} from "@/lib/actions/merchant";
import type { AttributionModel, AutomaticImprovementsDoc, ConversionSourceDoc } from "@/lib/providers/google";
import type { AppsPage } from "@/lib/shopping";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { F, NumInput, Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Done = { ok: true } | { ok: false; error: string };

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

// ---- automatic improvements

const IMPROVEMENTS: { key: keyof ImprovementSettings; label: string; hint: string }[] = [
  { key: "price", label: "Price updates", hint: "Fix a product's price when the website shows a different one." },
  { key: "availability", label: "Availability updates", hint: "Fix in stock / out of stock to match the website." },
  { key: "strictAvailability", label: "Strict availability", hint: "Also mark products out of stock when the website's structured data says so, even without other signals." },
  { key: "condition", label: "Condition updates", hint: "Fix new / used / refurbished to match the website." },
  { key: "images", label: "Image improvements", hint: "Remove overlays such as promotional text from product images." },
  { key: "shipping", label: "Shipping improvements", hint: "Use Google's estimates when they're more precise than the delivery times you set." },
];

const toSettings = (d: AutomaticImprovementsDoc): ImprovementSettings => {
  const i = d.itemUpdates;
  return {
    price: i?.accountItemUpdatesSettings?.allowPriceUpdates ?? i?.effectiveAllowPriceUpdates ?? false,
    availability: i?.accountItemUpdatesSettings?.allowAvailabilityUpdates ?? i?.effectiveAllowAvailabilityUpdates ?? false,
    strictAvailability: i?.accountItemUpdatesSettings?.allowStrictAvailabilityUpdates ?? i?.effectiveAllowStrictAvailabilityUpdates ?? false,
    condition: i?.accountItemUpdatesSettings?.allowConditionUpdates ?? i?.effectiveAllowConditionUpdates ?? false,
    images: d.imageImprovements?.accountImageImprovementsSettings?.allowAutomaticImageImprovements ?? d.imageImprovements?.effectiveAllowAutomaticImageImprovements ?? false,
    shipping: d.shippingImprovements?.allowShippingImprovements ?? false,
  };
};

export function AutomaticImprovementsCard({ projectId, doc }: { projectId: string; doc: AutomaticImprovementsDoc }) {
  const canEdit = useCan("merchant.manage");
  const [saved] = useState(() => toSettings(doc));
  const [v, setV] = useState(saved);
  const [pending, run] = useWrite();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic improvements</CardTitle>
        <CardDescription>Let Google correct products from what it finds on the store&apos;s website, so they aren&apos;t disapproved for mismatches.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <fieldset disabled={!canEdit || pending} className="flex flex-col gap-3">
          {IMPROVEMENTS.map((o) => {
            const off = o.key === "strictAvailability" && !v.availability;
            return (
              <label key={o.key} className="flex items-start gap-3">
                <Checkbox className="mt-0.5" aria-label={o.label} disabled={off} checked={v[o.key] && !off} onCheckedChange={(c) => setV({ ...v, [o.key]: c === true })} />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{o.label}</span>
                  <span className="text-muted-foreground text-xs">{off ? "Turn on availability updates first." : o.hint}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        {canEdit && (
          <div className="flex gap-2">
            <Button disabled={pending || !dirty} onClick={() => run(() => saveAutomaticImprovements(projectId, v), "Automatic improvements saved.")}>
              {pending && <Spinner data-icon="inline-start" />}
              Save
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

// ---- conversion settings

const MODEL_LABEL: Record<AttributionModel, string> = {
  CROSS_CHANNEL_DATA_DRIVEN: "Data-driven",
  CROSS_CHANNEL_LAST_CLICK: "Last click",
  ADS_PREFERRED_LAST_CLICK: "Ads-preferred last click",
  CROSS_CHANNEL_FIRST_CLICK: "First click",
  CROSS_CHANNEL_LINEAR: "Linear",
  CROSS_CHANNEL_POSITION_BASED: "Position-based",
  CROSS_CHANNEL_TIME_DECAY: "Time decay",
};
const MODELS = Object.entries(MODEL_LABEL).map(([value, label]) => ({ value: value as AttributionModel, label }));
const STATE: Record<string, { label: string; variant: "secondary" | "outline" }> = {
  ACTIVE: { label: "Active", variant: "secondary" },
  PENDING: { label: "Pending", variant: "outline" },
  ARCHIVED: { label: "Archived", variant: "outline" },
};

const sourceLabel = (s: ConversionSourceDoc) =>
  s.googleAnalyticsLink ? `Google Analytics property ${s.googleAnalyticsLink.propertyId}` : (s.merchantCenterDestination?.displayName ?? "Merchant Center tag");

export function ConversionSources({ projectId, sources, gaPropertyId }: { projectId: string; sources: ConversionSourceDoc[]; gaPropertyId: string | null }) {
  const canEdit = useCan("merchant.manage");
  const [pending, run] = useWrite();
  const [adding, setAdding] = useState<null | "ga" | "tag">(null);
  const [editing, setEditing] = useState<ConversionSourceDoc | null>(null);
  const [form, setForm] = useState({ propertyId: gaPropertyId?.replace(/^properties\//, "") ?? "", displayName: "", currencyCode: "", model: "CROSS_CHANNEL_DATA_DRIVEN" as AttributionModel, days: 30 });
  const hasGa = sources.some((s) => s.googleAnalyticsLink && s.state !== "ARCHIVED");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion sources</CardTitle>
        <CardDescription>Where Merchant Center gets sales and other conversions from, to report them for free listings and Shopping ads.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sources.length === 0 ? (
          <p className="text-muted-foreground text-sm">No conversion sources yet. Link Google Analytics, or add a Merchant Center tag for the website.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Attribution</TableHead>
                <TableHead>Status</TableHead>
                {canEdit && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => {
                const a = s.googleAnalyticsLink?.attributionSettings ?? s.merchantCenterDestination?.attributionSettings;
                const st = STATE[s.state ?? ""] ?? { label: "Unknown", variant: "outline" as const };
                const tag = Boolean(s.merchantCenterDestination);
                return (
                  <TableRow key={s.name}>
                    <TableCell>
                      <span className="block font-medium">{sourceLabel(s)}</span>
                      <span className="text-muted-foreground block text-xs">
                        {tag ? `Merchant Center tag · ${s.merchantCenterDestination?.currencyCode ?? ""}${s.merchantCenterDestination?.destination ? ` · ${s.merchantCenterDestination.destination}` : ""}` : "Google Analytics link"}
                        {s.controller === "YOUTUBE_AFFILIATES" ? " · managed by YouTube" : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a?.attributionModel ? MODEL_LABEL[a.attributionModel] : "—"}
                      {a?.attributionLookbackWindowDays ? ` · ${a.attributionLookbackWindowDays} days` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        {tag && s.state !== "ARCHIVED" && s.controller !== "YOUTUBE_AFFILIATES" && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Edit attribution for ${sourceLabel(s)}`}
                            onClick={() => {
                              setForm({ ...form, model: a?.attributionModel ?? "CROSS_CHANNEL_DATA_DRIVEN", days: a?.attributionLookbackWindowDays ?? 30 });
                              setEditing(s);
                            }}
                          >
                            <PencilIcon />
                          </Button>
                        )}
                        {s.state !== "ARCHIVED" && s.controller !== "YOUTUBE_AFFILIATES" && (
                          <ConfirmDelete
                            triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Remove ${sourceLabel(s)}`} disabled={pending} />}
                            title={`Remove "${sourceLabel(s)}"?`}
                            description={tag ? "Conversions stop being reported from it. Merchant Center keeps it archived for 30 days, so it can be restored there." : "The Analytics link is removed; link the property again to restore it."}
                            details={[{ label: "Source", value: sourceLabel(s) }]}
                            confirmLabel="Remove"
                            onConfirm={() => run(() => removeConversionSource(projectId, s.name!), "Conversion source removed.")}
                          >
                            <Trash2Icon />
                          </ConfirmDelete>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {!hasGa && (
              <Button variant="outline" size="sm" onClick={() => setAdding("ga")}>
                <PlusIcon data-icon="inline-start" />
                Link Google Analytics
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setAdding("tag")}>
              <PlusIcon data-icon="inline-start" />
              Add Merchant Center tag
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={adding != null || editing != null} onOpenChange={(o) => !o && (setAdding(null), setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit attribution" : adding === "ga" ? "Link Google Analytics" : "Add Merchant Center tag"}</DialogTitle>
            <DialogDescription>
              {editing
                ? sourceLabel(editing)
                : adding === "ga"
                  ? "Conversions recorded in this GA4 property are reported in Merchant Center. You need edit access to the property."
                  : "Creates a conversion tag for the website; Merchant Center then shows how to install it."}
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={pending} className="flex flex-col gap-3">
            {adding === "ga" && !editing && (
              <F label="GA4 property ID">
                <Input aria-label="GA4 property ID" placeholder="e.g. 123456789" value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value.replace(/[^\d]/g, "") })} />
              </F>
            )}
            {adding === "tag" && !editing && (
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Name">
                  <Input aria-label="Conversion source name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                </F>
                <F label="Currency (3 letters)">
                  <Input aria-label="Conversion currency" maxLength={3} placeholder="PKR" value={form.currencyCode} onChange={(e) => setForm({ ...form, currencyCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
                </F>
              </div>
            )}
            {(editing || adding === "tag") && (
              <div className="grid gap-3 sm:grid-cols-2">
                <F label="Attribution model">
                  <Pick label="Attribution model" value={form.model} options={MODELS} onChange={(model) => setForm({ ...form, model })} />
                </F>
                <F label="Lookback window (days, 1–90)">
                  <NumInput label="Lookback days" min={1} value={form.days} onChange={(n) => setForm({ ...form, days: n ?? 30 })} />
                </F>
              </div>
            )}
          </fieldset>
          <DialogFooter>
            <Button variant="ghost" onClick={() => (setAdding(null), setEditing(null))}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                const close = () => (setAdding(null), setEditing(null));
                if (editing) return run(() => updateConversionAttribution(projectId, editing.name!, form.model, form.days), "Attribution updated.", close);
                if (adding === "ga") return run(() => addConversionSource(projectId, { kind: "ga", propertyId: form.propertyId }), "Google Analytics linked.", close);
                run(
                  () => addConversionSource(projectId, { kind: "tag", displayName: form.displayName, currencyCode: form.currencyCode, attributionModel: form.model, lookbackDays: form.days }),
                  "Conversion source added. Install its tag from Merchant Center.",
                  close,
                );
              }}
            >
              {pending && <Spinner data-icon="inline-start" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---- apps and services

const SERVICE_KIND = (s: AppsPage["services"][number]) =>
  [
    s.productsManagement && "Manages products",
    s.campaignsManagement && "Runs campaigns",
    s.accountManagement && "Manages the account",
    s.accountAggregation && "Groups accounts",
    s.localListingManagement && "Manages local listings",
    s.comparisonShopping && "Comparison shopping",
  ]
    .filter(Boolean)
    .join(", ") || "Linked service";
const providerName = (p?: string, display?: string) => display || (p === "providers/GOOGLE_ADS" ? "Google Ads" : p === "providers/GOOGLE_BUSINESS_PROFILE" ? "Google Business Profile" : (p ?? "—"));
const HANDSHAKE: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  ESTABLISHED: { label: "Linked", variant: "secondary" },
  PENDING: { label: "Waiting for you", variant: "outline" },
  WAITING: { label: "Waiting for them", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

export function AppsAndServices({ projectId, data }: { projectId: string; data: AppsPage }) {
  const canEdit = useCan("merchant.manage");
  const [pending, run] = useWrite();
  const [email, setEmail] = useState("");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Google Business Profile</CardTitle>
          <CardDescription>Links the store&apos;s physical locations, for local listings and store details on Google.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {data.gbp == null ? (
            <p className="text-muted-foreground text-sm">Business Profile accounts can only be listed by a Google account that manages them.</p>
          ) : data.gbp.length === 0 ? (
            <p className="text-muted-foreground text-sm">No Business Profile linked.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.gbp.map((g) => (
                <li key={g.name} className="flex items-center justify-between py-2">
                  <span className="font-medium">{g.gbpAccountName || g.gbpAccountId}</span>
                  <span className="text-muted-foreground text-xs">
                    {g.type === "BUSINESS_ACCOUNT" ? "Business account" : "Personal account"} · {Number(g.listingCount ?? 0).toLocaleString()} locations
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <F label="Email that manages the Business Profile" className="w-full sm:w-80">
                <Input aria-label="Business Profile email" type="email" value={email} disabled={pending} onChange={(e) => setEmail(e.target.value)} />
              </F>
              <Button variant="outline" disabled={pending || !email.trim()} onClick={() => run(() => linkBusinessProfile(projectId, email), "Link requested. Approve it in Business Profile.", () => setEmail(""))}>
                Link Business Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked services</CardTitle>
          <CardDescription>Apps, Google Ads accounts and agencies connected to this Merchant Center account.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.services.length === 0 ? (
            <p className="text-muted-foreground text-sm">No linked services.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>What it does</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-40" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.services.map((s) => {
                  const h = HANDSHAKE[s.handshake?.approvalState ?? ""] ?? { label: "—", variant: "outline" as const };
                  const decide = canEdit && s.handshake?.approvalState === "PENDING";
                  return (
                    <TableRow key={s.name}>
                      <TableCell>
                        <span className="block font-medium">{providerName(s.provider, s.providerDisplayName)}</span>
                        {s.externalAccountId && <span className="text-muted-foreground block text-xs">Account {s.externalAccountId}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{SERVICE_KIND(s)}</TableCell>
                      <TableCell>
                        <Badge variant={h.variant}>{h.label}</Badge>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          {decide && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" disabled={pending} onClick={() => run(() => decideServiceLink(projectId, s.name!, true), "Link approved.")}>
                                Approve
                              </Button>
                              <ConfirmDelete
                                triggerRender={<Button size="sm" variant="ghost" disabled={pending} />}
                                title={`Reject ${providerName(s.provider, s.providerDisplayName)}?`}
                                description="The link request is declined. They'd have to ask again to connect."
                                details={[{ label: "Service", value: SERVICE_KIND(s) }]}
                                confirmLabel="Reject"
                                onConfirm={() => run(() => decideServiceLink(projectId, s.name!, false), "Link rejected.")}
                              >
                                Reject
                              </ConfirmDelete>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data.relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
            <CardDescription>Other accounts this Merchant Center account has a relationship with.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {data.relationships.map((r) => (
                <li key={r.name} className="flex items-center justify-between py-2">
                  <span className="font-medium">{providerName(r.provider, r.providerDisplayName)}</span>
                  {r.accountIdAlias && <span className="text-muted-foreground text-xs">Known there as {r.accountIdAlias}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
