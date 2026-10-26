import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppLogo } from "@/components/app-logo";
import { getSession } from "@/lib/session";

async function RedirectIfSignedIn() {
  if (await getSession()) redirect("/projects");
  return null;
}

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <AppLogo className="text-lg" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-muted-foreground text-center text-xs">Open source SEO dashboard · self-hosted</p>
    </main>
  );
}
