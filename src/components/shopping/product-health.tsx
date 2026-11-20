"use client";

import { useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { ProductHealth } from "@/lib/shopping";
import type { ProductHealthStatus, ProductIssue } from "@/lib/providers/google";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/shopping-labels";

const STATUS_BADGE: Record<ProductHealthStatus, "secondary" | "outline" | "destructive"> = {
  APPROVED: "secondary",
  LIMITED: "outline",
  PENDING: "outline",
  DISAPPROVED: "destructive",
};
const SEVERITY_LABEL: Record<ProductIssue["severity"], string> = { DISAPPROVED: "Disapproves", DEMOTED: "Limits", NOT_IMPACTED: "No impact" };
const SEVERITY_BADGE: Record<ProductIssue["severity"], "destructive" | "outline" | "secondary"> = {
  DISAPPROVED: "destructive",
  DEMOTED: "outline",
  NOT_IMPACTED: "secondary",
};

type Filter = "all" | ProductHealthStatus;

/** Issues across the catalogue, and the products that aren't fully approved. */
export function ProductHealthPanel({ health }: { health: ProductHealth }) {
  const [filter, setFilter] = useState<Filter>("all");
  const products = useMemo(() => (filter === "all" ? health.problems : health.problems.filter((p) => p.status === filter)), [health.problems, filter]);
  const issuePages = usePaged(health.issues);
  const productPages = usePaged(products);
  // Counted from the listed products, so each option's number matches what it shows
  const count = (s: ProductHealthStatus) => health.problems.filter((p) => p.status === s).length;
  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `All with issues (${formatNumber(health.problems.length)})` },
    { value: "DISAPPROVED", label: `Disapproved (${formatNumber(count("DISAPPROVED"))})` },
    { value: "LIMITED", label: `Limited (${formatNumber(count("LIMITED"))})` },
    { value: "PENDING", label: `Pending (${formatNumber(count("PENDING"))})` },
    { value: "APPROVED", label: `Approved with issues (${formatNumber(count("APPROVED"))})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Issues</h3>
        {health.issues.length === 0 ? (
          <p className="text-muted-foreground text-sm">Google reports no product issues.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue</TableHead>
                  <TableHead>Effect</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issuePages.shown.map((i) => (
                  <TableRow key={i.code}>
                    <TableCell className="max-w-md">
                      <span className="flex items-center gap-1">
                        <span className="truncate">{i.description}</span>
                        {i.documentation && (
                          <a href={i.documentation} target="_blank" rel="noreferrer noopener" aria-label={`How to fix: ${i.description}`} className="text-muted-foreground hover:text-foreground shrink-0">
                            <ExternalLinkIcon className="size-3" />
                          </a>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_BADGE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(i.products)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePager page={issuePages.page} total={health.issues.length} onPage={issuePages.setPage} />
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Pick
          label="Filter products by status"
          className="sm:w-64"
          value={filter}
          options={filters}
          onChange={(f) => {
            setFilter(f);
            productPages.setPage(0);
          }}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground h-20 text-center">
                  No products here.
                </TableCell>
              </TableRow>
            ) : (
              productPages.shown.map((p) => (
                <TableRow key={p.offerId}>
                  <TableCell className="max-w-72">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 hover:underline">
                        <span className="truncate font-medium">{p.title}</span>
                        <ExternalLinkIcon className="text-muted-foreground size-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="block truncate font-medium">{p.title}</span>
                    )}
                    <span className="text-muted-foreground block truncate text-xs">{p.offerId}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    {p.issues.length === 0 ? (
                      <span className="text-muted-foreground text-xs">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {p.issues.map((i) => (
                          <li key={i.code} className="text-sm" title={i.detail ?? undefined}>
                            <Badge variant={SEVERITY_BADGE[i.severity]} className="mr-1.5 text-[10px]">
                              {SEVERITY_LABEL[i.severity]}
                            </Badge>
                            {i.description}
                            {i.attribute && <span className="text-muted-foreground"> ({i.attribute})</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePager page={productPages.page} total={products.length} onPage={productPages.setPage} />
      </div>
    </div>
  );
}
