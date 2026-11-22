"use client";

import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { toggleProgram } from "@/lib/actions/merchant";
import type { ProgramDoc } from "@/lib/providers/google";
import { ConfirmDelete } from "@/components/confirm-delete";
import { useCan } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

type Info = { title: string; text: string; group: "online" | "local" };
// Merchant Center's wording for the programs it shows; others fall back to their ID
const INFO: Record<string, Info> = {
  "shopping-ads": {
    title: "Shopping ads",
    text: "Advertise your products on all Google Ads channels, including YouTube, Search and Discover. You only pay when people click, and you can stop your campaign whenever you want.",
    group: "online",
  },
  "free-listings": {
    title: "Free listings",
    text: "Your products can show organically across Google.",
    group: "online",
  },
  checkout: {
    title: "Checkout on Google",
    text: "Let shoppers buy your products directly on Google.",
    group: "online",
  },
  "youtube-shopping-checkout": {
    title: "YouTube Shopping checkout",
    text: "Let viewers buy your products without leaving YouTube.",
    group: "online",
  },
  "youtube-affiliate": {
    title: "YouTube Shopping affiliate",
    text: "Let YouTube creators feature your products and earn a commission.",
    group: "online",
  },
  "local-inventory-ads": {
    title: "Local inventory ads",
    text: "Let nearby shoppers know your store has the products they're looking for, with ads that show what's in stock.",
    group: "local",
  },
  "free-local-listings": {
    title: "Free local listings",
    text: "Show your in-store products to customers across Google, for free.",
    group: "local",
  },
};
const idOf = (p: ProgramDoc) => p.name?.split("/").pop() ?? "";
const infoOf = (p: ProgramDoc): Info => {
  const id = idOf(p);
  return (
    INFO[id] ?? {
      title: id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
      text: "",
      group: "online",
    }
  );
};
const httpsOnly = (u?: string) => (u && /^https:\/\//.test(u) ? u : undefined);
/** Google sometimes sends a requirement as a code (HAS_KOREAN_BUSINESS_REGISTRATION_NUMBER); make it a sentence. */
const readable = (t?: string) =>
  t && /^[A-Z0-9_]+$/.test(t)
    ? t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ")
    : (t ?? "Requirement");
/** "learn more about free listings", but "learn more about YouTube …" keeps its capitals. */
const lowerFirst = (t: string) =>
  /^[A-Z][a-z]*(\s|$)/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;

const BADGE: Record<string, { label: string; className: string }> = {
  ENABLED: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  ELIGIBLE: { label: "Off", className: "bg-muted text-muted-foreground" },
  NOT_ELIGIBLE: {
    label: "Setup required",
    className: "bg-muted text-muted-foreground",
  },
};

function ProgramCard({
  projectId,
  program,
}: {
  projectId: string;
  program: ProgramDoc;
}) {
  const canEdit = useCan("marketing-methods.edit");
  const [pending, startTransition] = useTransition();
  const info = infoOf(program);
  const on = program.state === "ENABLED";
  const badge = BADGE[program.state ?? ""] ?? {
    label: "Unknown",
    className: "bg-muted text-muted-foreground",
  };
  const docs = httpsOnly(program.documentationUri);
  const set = (enable: boolean) =>
    startTransition(async () => {
      const res = await toggleProgram(projectId, program.name!, enable);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${info.title} turned ${enable ? "on" : "off"}.`);
    });

  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-1 flex-col gap-3 py-5">
        <Badge className={`w-fit rounded-sm font-normal ${badge.className}`}>
          {badge.label}
        </Badge>
        <h3 className="text-lg font-medium">{info.title}</h3>
        <p className="text-muted-foreground text-sm">
          {info.text}{" "}
          {docs && (
            <a
              href={docs}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
            >
              Learn more about {lowerFirst(info.title)}
              <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </p>
        {(program.activeRegionCodes ?? []).length > 0 && (
          <p
            className="text-muted-foreground text-xs"
            title={program.activeRegionCodes!.join(", ")}
          >
            Active in{" "}
            {program.activeRegionCodes!.length > 8
              ? `${program.activeRegionCodes!.length} countries`
              : program.activeRegionCodes!.join(", ")}
          </p>
        )}
        {(program.unmetRequirements ?? []).length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {program.unmetRequirements!.map((r, i) => (
              <li key={i}>
                Needs:{" "}
                {httpsOnly(r.documentationUri) ? (
                  <a
                    href={httpsOnly(r.documentationUri)}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {readable(r.title)}
                  </a>
                ) : (
                  readable(r.title)
                )}
                {(r.affectedRegionCodes ?? []).length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({r.affectedRegionCodes!.join(", ")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {idOf(program) !== "shopping-ads" &&
          program.state !== "NOT_ELIGIBLE" && (
            <div className="flex items-center gap-4 pt-1">
              <span className="text-sm font-medium">
                {info.title} enabled: {on ? "On" : "Off"}
              </span>
              {on ? (
                <ConfirmDelete
                  triggerRender={
                    <Switch
                      aria-label={`Turn off ${info.title}`}
                      checked
                      disabled={!canEdit || pending}
                    />
                  }
                  title={`Turn off ${info.title}?`}
                  description="Products stop showing on Google through this program until it's turned on again."
                  details={[{ label: "Program", value: info.title }]}
                  confirmLabel="Turn off"
                  onConfirm={() => set(false)}
                >
                  {null}
                </ConfirmDelete>
              ) : (
                <Switch
                  aria-label={`Turn on ${info.title}`}
                  checked={false}
                  disabled={!canEdit || pending}
                  onCheckedChange={(c) => c && set(true)}
                />
              )}
            </div>
          )}
      </CardContent>
      {idOf(program) === "shopping-ads" && (
        <CardFooter className="gap-6 border-t py-4">
          <Link
            href={`/projects/${projectId}/shopping/ad-campaigns`}
            className="text-primary text-sm font-medium hover:underline"
          >
            Manage
          </Link>
          <a
            href="https://ads.google.com/aw/campaigns"
            target="_blank"
            rel="noreferrer"
            className="text-primary text-sm font-medium hover:underline"
          >
            View campaigns
          </a>
        </CardFooter>
      )}
    </Card>
  );
}

/** Marketing methods laid out like Merchant Center: program cards for the online store and for physical stores. */
export function MarketingMethods({
  projectId,
  programs,
}: {
  projectId: string;
  programs: ProgramDoc[];
}) {
  if (programs.length === 0)
    return (
      <p className="text-muted-foreground text-sm">
        No marketing methods reported for this account.
      </p>
    );
  const order = Object.keys(INFO);
  const sorted = [...programs].sort(
    (a, b) =>
      (order.indexOf(idOf(a)) + 1 || 99) - (order.indexOf(idOf(b)) + 1 || 99),
  );
  const groups = [
    {
      title: "For online store",
      items: sorted.filter((p) => infoOf(p).group === "online"),
    },
    {
      title: "For physical stores",
      items: sorted.filter((p) => infoOf(p).group === "local"),
    },
  ];
  return (
    <>
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{g.title}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {g.items.map((p) => (
                <ProgramCard key={p.name} projectId={projectId} program={p} />
              ))}
            </div>
          </section>
        ))}
    </>
  );
}
