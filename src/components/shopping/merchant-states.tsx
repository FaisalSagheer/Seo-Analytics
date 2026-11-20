import Link from "next/link";
import { PlugIcon, ShoppingBagIcon } from "lucide-react";
import { DemoAlert } from "@/components/dashboard/demo-alert";
import { RegisterMerchantButton } from "@/components/shopping/register-button";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { ShoppingProblem } from "@/lib/shopping";

const TITLE: Record<ShoppingProblem["kind"], string> = {
  api: "Enable the Merchant API",
  registration: "Register this app with Merchant Center",
  scope: "Reconnect Google",
  access: "No access to this Merchant Center account",
  other: "Couldn't read Merchant Center",
};

/** A Merchant API failure, with the fix where the app can offer one. */
export function ProblemAlert({ problem, projectId }: { problem: ShoppingProblem; projectId: string }) {
  return (
    <Alert variant={problem.kind === "other" ? "destructive" : "default"}>
      <PlugIcon />
      <AlertTitle>{TITLE[problem.kind]}</AlertTitle>
      <AlertDescription>{problem.message}</AlertDescription>
      {problem.kind === "registration" && (
        <AlertAction>
          <RegisterMerchantButton projectId={projectId} />
        </AlertAction>
      )}
      {problem.kind === "scope" && (
        <AlertAction>
          <Link href="/settings" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Google & API
          </Link>
        </AlertAction>
      )}
    </Alert>
  );
}

/** Shown on every Shopping tab when there is no Merchant Center account to read. */
export function NoMerchant({ project }: { project: { id: string; isDemo: boolean } }) {
  return (
    <>
      {project.isDemo && <DemoAlert />}
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingBagIcon />
          </EmptyMedia>
          <EmptyTitle>{project.isDemo ? "No Merchant Center in the demo" : "No Merchant Center account selected"}</EmptyTitle>
          <EmptyDescription>
            {project.isDemo ? "Demo projects have no Merchant Center data." : "Choose the store's Merchant Center account in Project settings to manage it here."}
          </EmptyDescription>
        </EmptyHeader>
        {!project.isDemo && (
          <Link href={`/projects/${project.id}/settings`} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Project settings
          </Link>
        )}
      </Empty>
    </>
  );
}
