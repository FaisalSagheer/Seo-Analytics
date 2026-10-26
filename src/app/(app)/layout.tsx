import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects } from "@/lib/queries";
import { requireUser } from "@/lib/session";

/**
 * The signed-in shell is per-user (session + project list). SidebarProvider and
 * Sidebar live in the same boundary on purpose: if the Sidebar hydrated after
 * the provider, the provider's isMobile would already be true on phones and the
 * Sidebar would render its mobile branch against desktop server HTML.
 * Pages below still stream on their own through loading.tsx.
 */
async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const projects = await listProjects(user.id);
  return (
    <SidebarProvider>
      <AppSidebar
        projects={projects.map((p) => ({ id: p.id, name: p.name, domain: p.domain, isDemo: p.isDemo }))}
        user={{ name: user.name, email: user.email, image: user.image }}
      />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

// Plain markup shaped like the shell; SidebarMenuSkeleton picks a random width, which can't prerender
function ShellFallback() {
  return (
    <div className="flex min-h-svh">
      <div className="bg-sidebar hidden w-64 shrink-0 flex-col gap-2 border-r p-2 md:flex">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
