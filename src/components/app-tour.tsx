"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { NextStep, NextStepProvider, useNextStep, type CardComponentProps, type Step } from "nextstepjs";
import { markPageTourSeen, markTourSeen } from "@/lib/actions/tour";
import { MERCHANT_PERMISSIONS } from "@/lib/permissions";
import { PAGE_TOURS, pageKey } from "@/lib/tour-pages";
import { useViewerRole } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";

const TOUR = "welcome";
const PAGE_TOUR = "page";

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
      // At the top-left corner: below and left-aligned keeps the card on screen
      side: "bottom-left",
      title: "Your websites",
      content: "Switch between your projects here. Everything below belongs to the project you pick.",
    },
    {
      selector: '[data-tour="search"]',
      side: "right",
      title: "Analytics and SEO tools",
      content: "Analytics shows your clicks, visitors and referrals. SEO tools has Rankings for your keywords, Site audit for problems on your pages, and Backlinks.",
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
      content: "Connect Google here in Project settings, then pick the site and properties. The numbers fill in once it's connected.",
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
      // The menu sits at the screen's left edge: line the card up with it instead of centring over it
      side: "top-left",
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

const visible = (selector: string) => {
  const el = document.querySelector(selector);
  // A hidden element (closed phone sidebar) has no layout box
  return Boolean(el && (el as HTMLElement).getClientRects().length > 0);
};

/** A page's tour from its text in tour-pages.ts, keeping only the steps that have something on screen to point at. */
function buildPageSteps(key: string): TourStep[] {
  const tour = PAGE_TOURS[key];
  if (!tour) return [];
  const title = document.querySelector('[data-tour="page-header"] h1')?.textContent?.trim() || "This page";
  const snug = { pointerPadding: 6, pointerRadius: 10 };
  const steps: TourStep[] = [];
  steps.push(visible('[data-tour="page-header"]') ? { selector: '[data-tour="page-header"]', side: "bottom-left", title, content: tour.intro, ...snug } : { title, content: tour.intro });
  if (tour.filters && visible('[data-tour="page-actions"]')) {
    steps.push({ selector: '[data-tour="page-actions"]', side: "bottom-right", title: "Filters", content: tour.filters, ...snug });
  }
  // No target: shown in the middle of the screen
  if (tour.tip) steps.push({ title: "Good to know", content: tour.tip });
  return steps;
}

type TourControls = { restartWelcome: () => void; startPageTour: () => void; hasPageTour: boolean };
const Controls = createContext<TourControls>({ restartWelcome: () => {}, startPageTour: () => {}, hasPageTour: false });

/** For the user menu: replay the welcome tour, or tour the page that's open. */
export function useTours() {
  return useContext(Controls);
}

/** Runs inside the NextStep provider: starts tours at the right moment and exposes the menu controls. */
function TourController({
  tourSeen,
  ready,
  seenPages,
  welcomePath,
  setActiveKey,
  pageSteps,
  setPageSteps,
  children,
}: {
  tourSeen: boolean;
  ready: boolean;
  seenPages: string[];
  /** The page the welcome tour was finished on, if it was finished this visit */
  welcomePath: string | null;
  setActiveKey: (key: string) => void;
  pageSteps: TourStep[];
  setPageSteps: (steps: TourStep[]) => void;
  children: React.ReactNode;
}) {
  const { startNextStep, isNextStepVisible } = useNextStep();
  const pathname = usePathname();
  const key = pageKey(pathname);
  const runningRef = useRef(false);
  const wantStartRef = useRef(false);
  useEffect(() => {
    runningRef.current = isNextStepVisible;
  }, [isNextStepVisible]);

  // The welcome tour: once, for a user who hasn't seen it
  const welcomeStartedRef = useRef(false);
  useEffect(() => {
    if (tourSeen || !ready || welcomeStartedRef.current) return;
    welcomeStartedRef.current = true;
    // Let the sidebar finish laying out so the first target can be measured
    const t = setTimeout(() => startNextStep(TOUR), 800);
    return () => clearTimeout(t);
  }, [tourSeen, ready, startNextStep]);

  const beginPage = () => {
    if (!key) return;
    const steps = buildPageSteps(key);
    if (!steps.length) return;
    setActiveKey(key);
    wantStartRef.current = true;
    setPageSteps(steps);
  };
  // The steps are state, so start once they've been applied
  useEffect(() => {
    if (wantStartRef.current && pageSteps.length) {
      wantStartRef.current = false;
      startNextStep(PAGE_TOUR);
    }
  }, [pageSteps, startNextStep]);

  // A page's tour: the first time it's opened, once it has loaded, and never over another tour.
  // After the welcome tour it waits for the next page, so the two don't run back to back.
  const canAuto = tourSeen || (welcomePath != null && welcomePath !== pathname);
  const seen = key != null && seenPages.includes(key);
  useEffect(() => {
    if (!key || seen || !canAuto) return;
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (document.querySelector('[data-tour="page-header"]') && !document.querySelector("[data-skeleton]")) {
        clearInterval(id);
        if (!runningRef.current) beginPage();
      } else if (tries > 25) clearInterval(id);
    }, 400);
    return () => clearInterval(id);
    // beginPage only reads the path; the effect re-arms on navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, canAuto, seen]);

  return <Controls.Provider value={{ restartWelcome: () => startNextStep(TOUR), startPageTour: beginPage, hasPageTour: key != null }}>{children}</Controls.Provider>;
}

/** Wraps the signed-in shell. `tourSeen` is false until the user finishes or skips the welcome tour once. */
export function AppTour({ tourSeen, pageToursSeen, children }: { tourSeen: boolean; pageToursSeen: string[]; children: React.ReactNode }) {
  const role = useViewerRole();
  const pathname = usePathname();
  const [present, setPresent] = useState<Record<string, boolean> | null>(null);
  const [pageSteps, setPageSteps] = useState<TourStep[]>([]);
  const [seenPages, setSeenPages] = useState(pageToursSeen);
  const [welcomePath, setWelcomePath] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const admin = Boolean(role?.isAdmin);
  const merchantEdit = Boolean(role?.permissions.some((k) => MERCHANT_PERMISSIONS.includes(k)));

  // Which sidebar targets exist: measured after each navigation, so the welcome tour matches what's on screen
  useEffect(() => {
    const t = setTimeout(() => {
      const found: Record<string, boolean> = {};
      for (const sel of ['[data-tour="project"]', '[data-tour="search"]', '[data-tour="merchant"]', '[data-tour="google"]', '[data-tour="team"]', '[data-tour="user"]']) found[sel] = visible(sel);
      setPresent(found);
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);

  const steps = useMemo(() => buildSteps((sel) => present?.[sel] ?? false, { admin, merchantEdit }), [present, admin, merchantEdit]);
  const finish = (tour: string | null) => {
    if (tour === PAGE_TOUR) {
      if (!activeKey) return;
      setSeenPages((seen) => (seen.includes(activeKey) ? seen : [...seen, activeKey]));
      void markPageTourSeen(activeKey);
    } else {
      setWelcomePath(pathname);
      void markTourSeen();
    }
  };
  // The sidebar scrolls: bring each step's target into view so the card lands next to it
  const reveal = (step: number, tour: string | null) => {
    const selector = (tour === PAGE_TOUR ? pageSteps : steps)[step]?.selector;
    if (!selector) return;
    setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({ block: "center", behavior: "instant" });
      // The tour measured the target before the scroll; a resize event makes it measure again
      window.dispatchEvent(new Event("resize"));
    }, 50);
  };

  return (
    <NextStepProvider>
      <NextStep
        steps={[
          { tour: TOUR, steps },
          { tour: PAGE_TOUR, steps: pageSteps },
        ]}
        cardComponent={TourCard}
        onStepChange={reveal}
        onComplete={finish}
        onSkip={(_, tour) => finish(tour)}
        shadowOpacity="0.45"
        cardTransition={{ duration: 0.25 }}
        arrowStyle={{ color: "var(--popover)" }}
        disableConsoleLogs
      >
        <TourController tourSeen={tourSeen} ready={present != null} seenPages={seenPages} welcomePath={welcomePath} setActiveKey={setActiveKey} pageSteps={pageSteps} setPageSteps={setPageSteps}>
          {children}
        </TourController>
      </NextStep>
    </NextStepProvider>
  );
}
