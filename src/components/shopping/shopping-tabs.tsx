"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "shipping", label: "Shipping & returns" },
];

/** Section tabs for Shopping, one route each. */
export function ShoppingTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}/shopping`;
  return (
    <nav aria-label="Shopping sections" className="flex flex-wrap gap-1 border-b">
      {TABS.map((t) => {
        const href = t.segment ? `${base}/${t.segment}` : base;
        const active = t.segment ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={t.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", active ? "border-primary text-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
