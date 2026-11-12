"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanSearchIcon } from "lucide-react";
import { toast } from "sonner";
import { runSiteAudit } from "@/lib/actions/audit";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCan } from "@/components/permissions-provider";

export function AuditButton({ projectId, label = "Run audit" }: { projectId: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allowed = useCan("data.sync");
  if (!allowed) return null;

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await runSiteAudit(projectId);
          if (!res.ok) toast.error(res.error);
          else toast.success("Audit finished");
          router.refresh();
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : <ScanSearchIcon data-icon="inline-start" />}
      {pending ? "Crawling…" : label}
    </Button>
  );
}
