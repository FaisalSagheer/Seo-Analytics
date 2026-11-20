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

/** Merchant Center account warnings (suspensions, policy issues), on every Shopping tab. */
export function AccountIssues({ issues }: { issues: AccountIssue[] }) {
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
          {issues.length > shown.length && <li>and {issues.length - shown.length} more in Merchant Center</li>}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
