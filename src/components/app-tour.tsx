"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NextStep, NextStepProvider, useNextStep, type CardComponentProps, type Step } from "nextstepjs";
import { markTourSeen } from "@/lib/actions/tour";
import { useViewerRole } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";

const TOUR = "welcome";

type TourStep = Omit<Step, "showControls" | "showSkip"> & { selector?: string };

/**
 * The first-login tour. Steps point at sidebar parts by `data-tour` attributes; a step whose target isn't on
 * screen (no project open, phone layout, a role without that menu) is left out instead of pointing at nothing.
 */
function buildSteps(present: (selector: string) => boolean, can: { admin: boolean; merchantEdit: boolean }): TourStep[] {
  const all: TourStep[] = [
    {
      title: "Welcome to Seo Engine",
      content: "A quick tour of where things are. It takes under a minute, and you can skip it any time.",
    },
    {
      selector: '[data-tour="project"]',
      side: "right",
      title: "Your websites",
      content: "Switch between your projects here. Everything below belongs to the project you pick.",
    },
    {
      selector: '[data-tour="search"]',
      side: "right",
      title: "Search and traffic",
      content: "Performance shows clicks and visitors, Rankings tracks your keywords, Site audit finds problems on your pages, and Reports breaks traffic down.",
    },
    {
      selector: '[data-tour="merchant"]',
      side: "right",
      title: "Merchant Center",
      content: can.merchantEdit
        ? "Your Google Shopping store: products, shipping, promotions and notifications. You can edit things here and save them to Google."
        : "Your Google Shopping store: products, shipping, promotions and notifications. Your role can view this; ask an admin if you need to change something.",
    },
    {
      selector: '[data-tour="google"]',
      side: "right",
      title: "Connect Google first",
      content: "Google & API is where you connect your Google account. The numbers fill in once it's connected.",
    },
    ...(can.admin
      ? [
          {
            selector: '[data-tour="team"]',
            side: "right",
            title: "Team and roles",
            content: "Add people and choose what each role can do.",
          } satisfies TourStep,
        ]
      : []),
    {
      selector: '[data-tour="user"]',
      side: "top",
      title: "Take the tour again",
      content: "Open your name here and choose Take the tour whenever you want a reminder.",
    },
  ];
  // A snug highlight around each target
  return all.filter((s) => !s.selector || present(s.selector)).map((s) => (s.selector ? { ...s, pointerPadding: 6, pointerRadius: 10 } : s));
}

function TourCard({ step, currentStep, totalSteps, nextStep, prevStep, skipTour, arrow }: CardComponentProps) {
  const last = currentStep === totalSteps - 1;
  return (
    <div role="dialog" aria-label={step.title} className="bg-popover text-popover-foreground w-80 max-w-[calc(100vw-2rem)] rounded-xl border p-4 shadow-lg">
      <h2 className="text-base font-semibold">{step.title}</h2>
      <p className="text-muted-foreground mt-1.5 text-sm">{step.content}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs tabular-nums">
          {currentStep + 1} of {totalSteps}
        </span>
        <div className="flex items-center gap-1.5">
          {skipTour && !last && (
            <Button size="sm" variant="ghost" onClick={skipTour}>
              Skip
            </Button>
          )}
          {currentStep > 0 && (
            <Button size="sm" variant="outline" onClick={prevStep}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={nextStep}>
            {last ? "Done" : "Next"}
          </Button>
        </div>
      </div>
      {arrow}
    </div>
  );
}

/** Starts the tour once for a user who hasn't seen it, and offers a restart. */
function TourStarter({ tourSeen, ready }: { tourSeen: boolean; ready: boolean }) {
  const { startNextStep } = useNextStep();
  const started = useRef(false);
  useEffect(() => {
    if (tourSeen || !ready || started.current) return;
    started.current = true;
    // Let the sidebar finish laying out so the first target can be measured
    const t = setTimeout(() => startNextStep(TOUR), 800);
    return () => clearTimeout(t);
  }, [tourSeen, ready, startNextStep]);
  return null;
}

/** Wraps the signed-in shell. `tourSeen` is false until the user finishes or skips the tour once. */
export function AppTour({ tourSeen, children }: { tourSeen: boolean; children: React.ReactNode }) {
  const role = useViewerRole();
  const pathname = usePathname();
  const [present, setPresent] = useState<Record<string, boolean> | null>(null);
  const admin = Boolean(role?.isAdmin);
  const merchantEdit = Boolean(role?.permissions.includes("merchant.manage"));

  // Which targets exist on this page: measured after each navigation, so the tour matches what's on screen
  useEffect(() => {
    const t = setTimeout(() => {
      const found: Record<string, boolean> = {};
      for (const sel of ['[data-tour="project"]', '[data-tour="search"]', '[data-tour="merchant"]', '[data-tour="google"]', '[data-tour="team"]', '[data-tour="user"]']) {
        const el = document.querySelector(sel);
        // A hidden sidebar (phone) has no layout box
        found[sel] = Boolean(el && (el as HTMLElement).getClientRects().length > 0);
      }
      setPresent(found);
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);

  const steps = useMemo(() => buildSteps((sel) => present?.[sel] ?? false, { admin, merchantEdit }), [present, admin, merchantEdit]);
  const finish = () => void markTourSeen();

  return (
    <NextStepProvider>
      <NextStep steps={[{ tour: TOUR, steps }]} cardComponent={TourCard} onComplete={finish} onSkip={finish} shadowOpacity="0.45" cardTransition={{ duration: 0.25 }} disableConsoleLogs>
        <TourStarter tourSeen={tourSeen} ready={present != null} />
        {children}
      </NextStep>
    </NextStepProvider>
  );
}

/** For the "Take the tour" menu item. */
export function useRestartTour() {
  const { startNextStep } = useNextStep();
  return () => startNextStep(TOUR);
}
