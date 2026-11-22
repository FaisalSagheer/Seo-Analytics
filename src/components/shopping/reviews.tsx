"use client";

import { StarIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeProductReview } from "@/lib/actions/merchant";
import type { ProductReviewDoc } from "@/lib/providers/google";
import { ConfirmDelete } from "@/components/confirm-delete";
import { StatCard } from "@/components/dashboard/stat-card";
import { useCan } from "@/components/permissions-provider";
import { TablePager, usePaged } from "@/components/performance/table-pager";
import { Pick } from "@/components/shopping/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** A review's rating on a 1–5 scale, whatever scale it was given on; null when it has none. */
function stars(r: ProductReviewDoc): number | null {
  const a = r.productReviewAttributes;
  if (a?.rating == null) return null;
  const min = Number(a.minRating ?? 1);
  const max = Number(a.maxRating ?? 5);
  if (!(max > min)) return null;
  return Math.min(5, Math.max(1, Math.round(1 + ((a.rating - min) / (max - min)) * 4)));
}

type Filter = "all" | "5" | "4" | "3" | "2" | "1" | "issues";

/** Product reviews in Merchant Center: average rating, a filter by stars, and removing spam. */
export function Reviews({ projectId, reviews }: { projectId: string; reviews: ProductReviewDoc[] }) {
  const canEdit = useCan("reviews.delete");
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");
  const rated = reviews.map((r) => ({ r, s: stars(r), issues: r.productReviewStatus?.itemLevelIssues ?? [] }));
  const withStars = rated.filter((x) => x.s != null);
  const average = withStars.length ? withStars.reduce((t, x) => t + x.s!, 0) / withStars.length : null;
  const count = (f: Filter) => (f === "all" ? rated.length : f === "issues" ? rated.filter((x) => x.issues.length).length : rated.filter((x) => String(x.s) === f).length);
  const shown = useMemo(
    () =>
      rated
        .filter((x) => filter === "all" || (filter === "issues" ? x.issues.length > 0 : String(x.s) === filter))
        .sort((a, b) => (b.r.productReviewAttributes?.reviewTime ?? "").localeCompare(a.r.productReviewAttributes?.reviewTime ?? "")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reviews, filter],
  );
  const pages = usePaged(shown);
  const options: { value: Filter; label: string }[] = [
    { value: "all", label: `All reviews (${count("all")})` },
    ...(["5", "4", "3", "2", "1"] as const).map((n) => ({ value: n as Filter, label: `${n} star${n === "1" ? "" : "s"} (${count(n)})` })),
    { value: "issues", label: `With issues (${count("issues")})` },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reviews" value={reviews.length.toLocaleString()} />
        <StatCard label="Average rating" value={average == null ? "—" : `${average.toFixed(1)} / 5`} />
        <StatCard label="Positive (4–5★)" value={(count("4") + count("5")).toLocaleString()} />
        <StatCard label="With issues" value={count("issues").toLocaleString()} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Product reviews</CardTitle>
          <CardDescription>Reviews sent to Merchant Center for product ratings on Google, newest first. Removing one takes it off Google, not off the site where it was written.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">No product reviews. They come from a review aggregator or a reviews feed connected in Merchant Center.</p>
          ) : (
            <>
              <Pick
                label="Filter reviews"
                className="sm:w-56"
                value={filter}
                options={options}
                onChange={(f) => {
                  setFilter(f);
                  pages.setPage(0);
                }}
              />
              {shown.length === 0 && <p className="text-muted-foreground text-sm">No reviews match.</p>}
              <ul className="divide-y">
                {pages.shown.map(({ r, s, issues }) => {
                  const a = r.productReviewAttributes ?? {};
                  return (
                    <li key={r.name} className="flex gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {s != null && (
                            <span className="flex" aria-label={`${s} of 5 stars`}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <StarIcon key={n} className={n <= s ? "size-3.5 fill-amber-400 text-amber-400" : "text-muted-foreground size-3.5"} />
                              ))}
                            </span>
                          )}
                          {a.title && <span className="font-medium">{a.title}</span>}
                          {a.isVerifiedPurchase && <Badge variant="secondary">Verified purchase</Badge>}
                        </div>
                        {a.content && <p className="text-sm">{a.content}</p>}
                        <p className="text-muted-foreground text-xs">
                          {[a.reviewerUsername, (a.productNames ?? []).join(", "), a.reviewTime && new Date(a.reviewTime).toLocaleDateString()].filter(Boolean).join(" · ")}
                        </p>
                        {issues.map((i, k) => (
                          <span key={k} className={i.severity === "DISAPPROVED" ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                            {i.description}
                          </span>
                        ))}
                      </div>
                      {canEdit && (
                        <ConfirmDelete
                          triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Remove review ${a.title ?? r.productReviewId}`} disabled={pending} />}
                          title="Remove this review from Google?"
                          description="It stops counting toward the product's rating on Google. If it comes from a feed or aggregator, it may be sent again unless removed there too."
                          details={[
                            { label: "Rating", value: s == null ? "—" : `${s} / 5` },
                            { label: "Review", value: a.title ?? r.productReviewId ?? "" },
                          ]}
                          confirmLabel="Remove"
                          onConfirm={() =>
                            startTransition(async () => {
                              const res = await removeProductReview(projectId, r.name!);
                              if (!res.ok) return void toast.error(res.error);
                              toast.success("Review removed.");
                            })
                          }
                        >
                          <Trash2Icon />
                        </ConfirmDelete>
                      )}
                    </li>
                  );
                })}
              </ul>
              <TablePager page={pages.page} total={shown.length} onPage={pages.setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
