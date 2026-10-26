"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { createDemoProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function DemoProjectButton({ variant = "outline" }: { variant?: "outline" | "default" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await createDemoProject();
          if (!res.ok) return void toast.error(res.error);
          router.push(`/projects/${res.data.id}`);
        })
      }
    >
      {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
      Add demo project
    </Button>
  );
}
