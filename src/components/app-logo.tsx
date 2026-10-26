import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" className="size-4" aria-hidden>
          <path d="M3 17l5-5 4 3 8-8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 7h5v5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Seo Engine
    </span>
  );
}
