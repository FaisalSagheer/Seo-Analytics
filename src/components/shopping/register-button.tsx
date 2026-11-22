"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { registerMerchantCenter } from "@/lib/actions/settings";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** One-time registration of this app with the project's Merchant Center account (needs Admin there). */
export function RegisterMerchantButton({ projectId }: { projectId: string }) {
  const allowed = useCan("google.edit");
  const [pending, startTransition] = useTransition();
  if (!allowed) return null;
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await registerMerchantCenter(projectId);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Registered with Merchant Center. Data may take a few minutes to appear.");
        })
      }
    >
      {pending && <Spinner data-icon="inline-start" />}
      Register
    </Button>
  );
}
