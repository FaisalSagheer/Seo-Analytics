"use client";

import { useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";
import { lookupDomain, type DomainLookup as Result } from "@/lib/actions/research";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TopPagesTable } from "@/components/domain/top-pages-table";

/** Ad-hoc overview of any domain, e.g. a competitor. Not stored as history. */
export function DomainLookup({ projectId }: { projectId: string }) {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await lookupDomain({ projectId, domain });
      if (!res.ok) return void setError(res.error);
      setError(null);
      setResult(res.data);
    });
  }

  const m = result?.metrics;
  const b = result?.backlinks;
  const stats = result
    ? [
        ["Organic keywords", formatNumber(m!.organicKeywords)],
        ["Est. traffic / mo", formatNumber(Math.round(m!.organicTraffic))],
        ["Traffic value", formatCurrency(m!.trafficCost, { compact: true })],
        ["Domain rank", String(b!.domainRank)],
        ["Referring domains", formatNumber(b!.referringDomains)],
        ["Backlinks", formatNumber(b!.backlinks)],
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Look up another domain</CardTitle>
        <CardDescription>Compare a competitor in this project&apos;s market. Cached for 24 hours.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex gap-2">
          <Input placeholder="competitor.com" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain" />
          <Button type="submit" disabled={pending || !domain.trim()}>
            {pending ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
            Analyze
          </Button>
        </form>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {result && (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {stats.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-1 rounded-lg border p-3">
                  <dt className="text-muted-foreground text-xs">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <TopPagesTable pages={result.pages} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
