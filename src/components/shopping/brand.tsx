"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBusinessIdentity } from "@/lib/actions/merchant";
import type { IdentityKey } from "@/lib/providers/google";
import type { BrandPage } from "@/lib/shopping";
import { StatCard } from "@/components/dashboard/stat-card";
import { useCan } from "@/components/permissions-provider";
import { PagedTable } from "@/components/performance/table-pager";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";

const LABELS: { key: IdentityKey; label: string }[] = [
  { key: "smallBusiness", label: "Small business" },
  { key: "womenOwned", label: "Women-owned" },
  { key: "blackOwned", label: "Black-owned" },
  { key: "latinoOwned", label: "Latino-owned" },
  { key: "veteranOwned", label: "Veteran-owned" },
];

/** Brand: identity labels shown with the store, and the brands across the catalogue. */
export function Brand({ projectId, data }: { projectId: string; data: BrandPage }) {
  const canEdit = useCan("merchant.manage");
  const [pending, startTransition] = useTransition();
  const initial = {
    labels: Object.fromEntries(LABELS.map((l) => [l.key, data.identity[l.key]?.identityDeclaration === "SELF_IDENTIFIES_AS"])) as Record<IdentityKey, boolean>,
    consent: data.identity.promotionsConsent === "PROMOTIONS_CONSENT_GIVEN",
  };
  const [saved, setSaved] = useState(initial);
  const [v, setV] = useState(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(saved);

  function save() {
    startTransition(async () => {
      const res = await saveBusinessIdentity(projectId, v.labels, v.consent);
      if (!res.ok) return void toast.error(res.error);
      setSaved(v);
      toast.success("Brand labels saved.");
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Business identity</CardTitle>
          <CardDescription>Labels Google can show next to your store and products, where it offers them. Only choose ones that describe the business.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <fieldset disabled={!canEdit || pending} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-4">
              {LABELS.map((l) => (
                <label key={l.key} className="flex items-center gap-2 text-sm">
                  <Checkbox aria-label={l.label} checked={v.labels[l.key]} onCheckedChange={(c) => setV({ ...v, labels: { ...v.labels, [l.key]: c === true } })} />
                  {l.label}
                </label>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox className="mt-0.5" aria-label="Use in promotions" checked={v.consent} onCheckedChange={(c) => setV({ ...v, consent: c === true })} />
              <span>
                Google may use these labels in its promotions
                <span className="text-muted-foreground block text-xs">For example, featuring small businesses during shopping events.</span>
              </span>
            </label>
          </fieldset>
          {canEdit && (
            <div className="flex gap-2">
              <Button disabled={pending || !dirty} onClick={save}>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Brands" value={data.brands.length.toLocaleString()} />
        <StatCard label="Products" value={data.total.toLocaleString()} />
        <StatCard label="With a brand" value={(data.total - data.noBrand).toLocaleString()} />
        <StatCard label="Missing a brand" value={data.noBrand.toLocaleString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brands in your catalogue</CardTitle>
          <CardDescription>
            How many products carry each brand. Products without one can be limited on Google.
            {data.noBrand > 0 && " Add the brand from Products."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <PagedTable
            header={
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            }
            empty={{ columns: 3, text: "No products have a brand yet." }}
            rows={data.brands.map((b) => (
              <TableRow key={b.brand}>
                <TableCell className="font-medium">{b.brand}</TableCell>
                <TableCell className="text-right tabular-nums">{b.products.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{data.total ? `${Math.round((b.products / data.total) * 100)}%` : "—"}</TableCell>
              </TableRow>
            ))}
          />
          {data.noBrand > 0 && (
            <Link href={`/projects/${projectId}/shopping/products`} className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}>
              Open Products
            </Link>
          )}
        </CardContent>
      </Card>
    </>
  );
}
