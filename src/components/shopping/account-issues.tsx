import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import type { AccountIssue } from "@/lib/providers/google";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const SEVERITY: Record<AccountIssue["severity"], { label: string; variant: "destructive" | "outline" | "secondary" }> = {
  CRITICAL: { label: "Critical", variant: "destructive" },
  ERROR: { label: "Error", variant: "destructive" },
  SUGGESTION: { label: "Suggestion", variant: "secondary" },
  OTHER: { label: "Notice", variant: "outline" },
};

/** Merchant Center account warnings (suspensions, policy issues), on the Shopping overview. */
export function AccountIssues({ issues, projectId }: { issues: AccountIssue[]; projectId: string }) {
  if (issues.length === 0) return null;
  const serious = issues.some((i) => i.severity === "CRITICAL" || i.severity === "ERROR");
  const shown = issues.slice(0, 4);
  return (
    <Alert variant={serious ? "destructive" : "default"}>
      <TriangleAlertIcon />
      <AlertTitle>
        Merchant Center reports {issues.length} account issue{issues.length === 1 ? "" : "s"}
      </AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1.5">
          {shown.map((i) => (
            <li key={i.title} className="flex flex-wrap items-center gap-2">
              <Badge variant={SEVERITY[i.severity].variant}>{SEVERITY[i.severity].label}</Badge>
              <span>{i.title}</span>
              {i.documentation && (
                <a href={i.documentation} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4">
                  How to fix
                </a>
              )}
            </li>
          ))}
          {issues.length > shown.length && (
            <li>
              <Link href={`/projects/${projectId}/shopping/notifications`} className="underline underline-offset-4">
                See all {issues.length} in Notifications
              </Link>
            </li>
          )}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** Every account issue with its details: the Notifications page. */
export function AccountIssueList({ issues }: { issues: AccountIssue[] }) {
  if (issues.length === 0) return <p className="text-muted-foreground text-sm">No notifications. Merchant Center reports no account issues.</p>;
  return (
    <ul className="divide-y">
      {issues.map((i) => (
        <li key={i.title} className="flex flex-col gap-1 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={SEVERITY[i.severity].variant}>{SEVERITY[i.severity].label}</Badge>
            <span className="font-medium">{i.title}</span>
          </div>
          {i.detail && <p className="text-muted-foreground text-sm">{i.detail}</p>}
          {i.destinations.length > 0 && <p className="text-muted-foreground text-xs">Affects: {i.destinations.map((d) => d.charAt(0) + d.slice(1).toLowerCase().replace(/_/g, " ")).join(", ")}</p>}
          {i.documentation && (
            <a href={i.documentation} target="_blank" rel="noreferrer noopener" className="w-fit text-sm underline underline-offset-4">
              How to fix
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
