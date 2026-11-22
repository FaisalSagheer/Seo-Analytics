"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { getPageSuggestions, type Suggestion } from "@/lib/actions/assistant";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";

/** A floating button on project pages: Gemini suggestions for the page, from the project's data. */
export function AssistantSphere() {
  const pathname = usePathname();
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ path: string; items: Suggestion[] } | null>(null);
  const [pending, startTransition] = useTransition();
  if (!projectId) return null;

  // Suggestions belong to the page they were made on; a new page starts empty
  const items = result?.path === pathname ? result.items : null;

  function ask() {
    startTransition(async () => {
      const res = await getPageSuggestions(projectId!, pathname);
      if (!res.ok) return void toast.error(res.error);
      setResult({ path: pathname, items: res.data.suggestions });
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Get suggestions for this page"
        onClick={() => setOpen(true)}
        className="fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-lg ring-4 ring-white/20 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:ring-white/10"
      >
        <SparklesIcon className="size-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Suggestions for this page</SheetTitle>
            <SheetDescription>Written by Gemini from this project&apos;s data. Check them before you act on them.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            {items == null ? (
              <Button onClick={ask} disabled={pending} className="self-start">
                {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                {pending ? "Thinking" : "Get suggestions"}
              </Button>
            ) : (
              <>
                <ol className="flex flex-col gap-3">
                  {items.map((s, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-muted-foreground mt-1 text-sm">{s.detail}</p>
                    </li>
                  ))}
                </ol>
                <Button variant="outline" onClick={ask} disabled={pending} className="self-start">
                  {pending && <Spinner data-icon="inline-start" />}
                  Ask again
                </Button>
              </>
            )}
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
              Needs a Gemini key on{" "}
              <Link href={`/projects/${projectId}/settings`} className="underline underline-offset-4">
                Project settings
              </Link>
              . Each request uses your Gemini quota.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
