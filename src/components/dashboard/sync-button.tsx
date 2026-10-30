"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { runSync } from "@/lib/actions/projects";
import type { SyncPart, SyncResult } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCan } from "@/components/permissions-provider";

const PART_LABELS: Record<SyncPart, string> = { rankings: "Rankings", domain: "Domain & backlinks", google: "Search Console & GA4" };

export function SyncButton({ projectId, parts, label = "Refresh data" }: { projectId: string; parts?: SyncPart[]; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allowed = useCan("data.sync");
  if (!allowed) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runSync(projectId, parts);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          const entries = Object.entries(res.data).filter(([, v]) => v) as [SyncPart, NonNullable<SyncResult[SyncPart]>][];
          const failed = entries.filter(([, v]) => !v.ok);
          const warned = entries.filter(([, v]) => v.ok && v.warning);
          if (failed.length === 0 && warned.length === 0) toast.success("Data refreshed");
          warned.forEach(([part, v]) => toast.warning(`${PART_LABELS[part]}: ${v.warning}`));
          failed.forEach(([part, v]) => toast.error(`${PART_LABELS[part]}: ${v.message}`));
          router.refresh();
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
      {pending ? "Refreshing…" : label}
    </Button>
  );
}
