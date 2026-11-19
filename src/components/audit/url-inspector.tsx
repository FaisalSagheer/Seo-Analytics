"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon, SearchCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { inspectUrl } from "@/lib/actions/inspect";
import type { UrlInspection } from "@/lib/providers/google";
import { useCan } from "@/components/permissions-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const VERDICT: Record<string, { label: string; variant: "secondary" | "destructive" | "outline"; tone: string }> = {
  PASS: { label: "URL is on Google", variant: "secondary", tone: "text-emerald-700 dark:text-emerald-400" },
  NEUTRAL: { label: "URL is not on Google", variant: "outline", tone: "text-amber-700 dark:text-amber-400" },
  FAIL: { label: "URL is not on Google: error", variant: "destructive", tone: "text-destructive" },
};

/** "INDEXING_ALLOWED" -> "Indexing allowed" */
function human(value: string | null | undefined) {
  if (!value) return "—";
  if (/_UNSPECIFIED$/.test(value)) return "Unknown";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const isHttp = (u: string) => /^https?:\/\//i.test(u);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function UrlText({ url }: { url: string | null }) {
  if (!url) return <>—</>;
  return isHttp(url) ? (
    <a href={url} target="_blank" rel="noreferrer noopener" className="hover:underline">
      {url}
    </a>
  ) : (
    <>{url}</>
  );
}

function InspectionResult({ url, result }: { url: string; result: UrlInspection }) {
  const v = VERDICT[result.verdict ?? ""] ?? { label: "Google has no verdict for this URL", variant: "outline" as const, tone: "" };
  const canonicalDiffers = result.googleCanonical && result.userCanonical && result.googleCanonical !== result.userCanonical;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={v.variant} className={v.tone}>
          {v.label}
        </Badge>
        {result.coverageState && <span className="text-muted-foreground">{result.coverageState}</span>}
      </div>

      {canonicalDiffers && (
        <Alert>
          <AlertTitle>Google chose a different canonical</AlertTitle>
          <AlertDescription>Google treats another URL as the main version of this page, so this one may not be the one that ranks.</AlertDescription>
        </Alert>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <Row label="URL">
          <UrlText url={url} />
        </Row>
        <Row label="Indexing">{human(result.indexingState)}</Row>
        <Row label="robots.txt">{human(result.robotsTxtState)}</Row>
        <Row label="Page fetch">{human(result.pageFetchState)}</Row>
        <Row label="Last crawl">{result.lastCrawlTime ? new Date(result.lastCrawlTime).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }) : "Not crawled yet"}</Row>
        <Row label="Crawled as">{human(result.crawledAs)}</Row>
        <Row label="Google's canonical">
          <UrlText url={result.googleCanonical} />
        </Row>
        <Row label="Your canonical">
          <UrlText url={result.userCanonical} />
        </Row>
        {result.sitemaps.length > 0 && (
          <Row label="In sitemaps">
            {result.sitemaps.map((s) => (
              <div key={s}>
                <UrlText url={s} />
              </div>
            ))}
          </Row>
        )}
        {result.referringUrls.length > 0 && (
          <Row label="Found via">
            {result.referringUrls.map((s) => (
              <div key={s}>
                <UrlText url={s} />
              </div>
            ))}
          </Row>
        )}
        {result.mobile && (
          <Row label="Mobile usability">
            {human(result.mobile.verdict)}
            {result.mobile.issues.length > 0 && <span className="text-muted-foreground">: {result.mobile.issues.join("; ")}</span>}
          </Row>
        )}
        {result.richResults && (
          <Row label="Rich results">
            {human(result.richResults.verdict)}
            {result.richResults.items.map((i) => (
              <div key={i.type} className="text-muted-foreground">
                {i.type}
                {i.issues.length > 0 ? `: ${i.issues.join("; ")}` : ""}
              </div>
            ))}
          </Row>
        )}
      </dl>

      {result.link && (
        <a href={result.link} target="_blank" rel="noreferrer noopener" className="text-muted-foreground inline-flex items-center gap-1 self-start text-sm hover:underline">
          Open in Search Console <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </div>
  );
}

/** Runs an inspection and shows it in a dialog; shared by the box and the table buttons. */
function useInspection(projectId: string) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ url: string; result: UrlInspection } | null>(null);
  const run = (url: string) =>
    startTransition(async () => {
      const res = await inspectUrl(projectId, url);
      if (!res.ok) return void toast.error(res.error);
      setData(res.data);
      setOpen(true);
    });
  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>URL inspection</DialogTitle>
          <DialogDescription>Google&apos;s current view of this page, from Search Console.</DialogDescription>
        </DialogHeader>
        {data && <InspectionResult url={data.url} result={data.result} />}
      </DialogContent>
    </Dialog>
  );
  return { pending, run, dialog };
}

/** The "Inspect a URL" box at the top of the Site audit page. */
export function UrlInspector({ projectId, property }: { projectId: string; property: string }) {
  const allowed = useCan("data.sync");
  const [url, setUrl] = useState("");
  const { pending, run, dialog } = useInspection(projectId);
  if (!allowed) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>URL inspection</CardTitle>
        <CardDescription>Check whether Google has indexed a page, when it last crawled it and which canonical it chose.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) run(url);
          }}
        >
          <Input
            aria-label="URL to inspect"
            placeholder={`A page on ${property.replace(/^sc-domain:/, "")}`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={pending || !url.trim()}>
            {pending ? <Spinner data-icon="inline-start" /> : <SearchCheckIcon data-icon="inline-start" />}
            Inspect
          </Button>
        </form>
      </CardContent>
      {dialog}
    </Card>
  );
}

/** A per-page Inspect button for the audit table. */
export function InspectButton({ projectId, url }: { projectId: string; url: string }) {
  const allowed = useCan("data.sync");
  const { pending, run, dialog } = useInspection(projectId);
  if (!allowed) return null;
  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(url)} aria-label={`Inspect ${url}`}>
        {pending ? <Spinner data-icon="inline-start" /> : <SearchCheckIcon data-icon="inline-start" />}
        Inspect
      </Button>
      {dialog}
    </>
  );
}
