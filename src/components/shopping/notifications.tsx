"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Notice, NoticeKind } from "@/lib/shopping";
import { usePaged, TablePager } from "@/components/performance/table-pager";
import { Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const KIND: Record<NoticeKind, string> = {
  account: "Account",
  products: "Products",
  feeds: "Data sources",
  programs: "Marketing methods",
  promotions: "Promotions",
};
const SEV: Record<
  Notice["severity"],
  { label: string; variant: "destructive" | "outline" | "secondary" }
> = {
  critical: { label: "Critical", variant: "destructive" },
  error: { label: "Error", variant: "destructive" },
  warning: { label: "Warning", variant: "outline" },
  info: { label: "Suggestion", variant: "secondary" },
};

type Filter = "all" | NoticeKind;

/** Everything that needs attention, most serious first, filterable by where it comes from. */
export function Notifications({ notices }: { notices: Notice[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () =>
      filter === "all" ? notices : notices.filter((n) => n.kind === filter),
    [notices, filter],
  );
  const pages = usePaged(shown);
  const count = (k: NoticeKind) => notices.filter((n) => n.kind === k).length;
  const serious = notices.filter(
    (n) => n.severity === "critical" || n.severity === "error",
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {notices.length === 0
            ? "Nothing needs attention"
            : `${notices.length} notification${notices.length === 1 ? "" : "s"}${serious ? `, ${serious} serious` : ""}`}
        </CardTitle>
        <CardDescription>
          Account issues, product issues, data source uploads, program
          requirements and promotions, most serious first.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {notices.length > 0 && (
          <Pick
            label="Filter notifications"
            className="sm:w-64"
            value={filter}
            options={[
              { value: "all" as Filter, label: `All (${notices.length})` },
              ...(Object.keys(KIND) as NoticeKind[]).map((k) => ({
                value: k as Filter,
                label: `${KIND[k]} (${count(k)})`,
              })),
            ]}
            onChange={(f) => {
              setFilter(f);
              pages.setPage(0);
            }}
          />
        )}
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {notices.length
              ? "Nothing here."
              : "Merchant Center reports no issues."}
          </p>
        ) : (
          <ul className="divide-y">
            {pages.shown.map((n, i) => (
              <li
                key={`${n.kind}-${n.title}-${i}`}
                className="flex flex-wrap items-start gap-3 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={SEV[n.severity].variant}>
                      {SEV[n.severity].label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {KIND[n.kind]}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{n.title}</span>
                  {n.detail && (
                    <span className="text-muted-foreground text-xs">
                      {n.detail}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {n.documentation && (
                    <a
                      href={n.documentation}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      How to fix
                    </a>
                  )}
                  <Link
                    href={n.href}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        <TablePager
          page={pages.page}
          total={shown.length}
          onPage={pages.setPage}
        />
      </CardContent>
    </Card>
  );
}
