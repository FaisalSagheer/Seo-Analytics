"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { lookupKeywordIdeas } from "@/lib/actions/research";
import { trackIdeas } from "@/lib/actions/projects";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { KeywordIdea, SearchIntent } from "@/lib/types";
import type { KeywordIdeasInput } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type Difficulty = "all" | "easy" | "medium" | "hard";

function getDifficultyLabel(kd: number) {
  if (kd < 30) return { label: "Easy", variant: "secondary" as const };
  if (kd < 60) return { label: "Medium", variant: "outline" as const };
  return { label: "Hard", variant: "destructive" as const };
}

function getIntentLabel(intent: SearchIntent) {
  switch (intent) {
    case "informational":
      return "Info";
    case "commercial":
      return "Commercial";
    case "transactional":
      return "Transactional";
    case "navigational":
      return "Navigational";
    default:
      return "—";
  }
}

function inDifficulty(kd: number, d: Difficulty) {
  switch (d) {
    case "easy":
      return kd < 30;
    case "medium":
      return kd >= 30 && kd < 60;
    case "hard":
      return kd >= 60;
    default:
      return true;
  }
}

export function KeywordIdeas({ projectId, locationCode, languageCode }: { projectId: string; locationCode: number; languageCode: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<KeywordIdeasInput>({ projectId, seeds: "", locationCode, languageCode, limit: 200 });
  const [ideas, setIdeas] = useState<KeywordIdea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [tracking, startTrack] = useTransition();
  const [minVolume, setMinVolume] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [intent, setIntent] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const min = Number(minVolume) || 0;
    return (ideas ?? []).filter(
      (i) => i.searchVolume >= min && inDifficulty(i.difficulty, difficulty) && (intent === "all" || i.intent === intent),
    );
  }, [ideas, minVolume, difficulty, intent]);
  const totalVolume = visible.reduce((s, i) => s + i.searchVolume, 0);

  function search(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const res = await lookupKeywordIdeas(draft);
      if (!res.ok) {
        // Keep the previous results on screen; the error goes in a banner above them
        setError(res.error);
        return;
      }
      setError(null);
      setIdeas(res.data);
      setSelected(new Set());
    });
  }

  function track() {
    const chosen = (ideas ?? []).filter((i) => selected.has(i.keyword));
    startTrack(async () => {
      const res = await trackIdeas({ projectId, ideas: chosen.map((i) => ({ keyword: i.keyword, searchVolume: i.searchVolume })) });
      if (!res.ok) return void toast.error(res.error);
      const skipped = chosen.length - res.data.added;
      if (res.data.added === 0) toast.info("Those keywords are already tracked");
      else toast.success(`Tracking ${res.data.added} new keyword${res.data.added === 1 ? "" : "s"}${skipped ? ` (${skipped} already tracked)` : ""}`);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Find keyword ideas</CardTitle>
          <CardDescription>Enter up to 20 seed keywords, comma-separated. Results are cached for 24 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1">
              <FieldLabel htmlFor="seeds">Seed keywords</FieldLabel>
              <Input
                id="seeds"
                placeholder="rank tracker, seo dashboard"
                value={draft.seeds}
                onChange={(e) => setDraft({ ...draft, seeds: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={searching}>
              {searching ? <Spinner data-icon="inline-start" /> : <SearchIcon data-icon="inline-start" />}
              Get ideas
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {ideas === null ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>Search to see ideas</EmptyTitle>
            <EmptyDescription>Volume, difficulty, CPC and intent for related keywords in this project&apos;s market.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Min. volume"
              className="h-8 w-32"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              aria-label="Minimum search volume"
            />
            <ToggleGroup variant="outline" size="sm" value={[difficulty]} onValueChange={(v) => v[0] && setDifficulty(v[0] as Difficulty)}>
              <ToggleGroupItem value="all">Any KD</ToggleGroupItem>
              <ToggleGroupItem value="easy">Easy</ToggleGroupItem>
              <ToggleGroupItem value="medium">Medium</ToggleGroupItem>
              <ToggleGroupItem value="hard">Hard</ToggleGroupItem>
            </ToggleGroup>
            <ToggleGroup variant="outline" size="sm" value={[intent]} onValueChange={(v) => v[0] && setIntent(v[0])}>
              <ToggleGroupItem value="all">Any intent</ToggleGroupItem>
              <ToggleGroupItem value="informational">Info</ToggleGroupItem>
              <ToggleGroupItem value="commercial">Commercial</ToggleGroupItem>
              <ToggleGroupItem value="transactional">Transactional</ToggleGroupItem>
            </ToggleGroup>
            <span className="text-muted-foreground ml-auto text-sm">
              {visible.length} ideas · {formatNumber(totalVolume)} searches/mo
            </span>
            {selected.size > 0 && (
              <Button size="sm" disabled={tracking} onClick={track}>
                <PlusIcon data-icon="inline-start" />
                Track {selected.size}
              </Button>
            )}
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Keyword</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">KD</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">Competition</TableHead>
                  <TableHead>Intent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground h-24 text-center">
                      No ideas match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((i) => {
                    const kd = getDifficultyLabel(i.difficulty);
                    return (
                      <TableRow key={i.keyword} data-state={selected.has(i.keyword) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Select ${i.keyword}`}
                            checked={selected.has(i.keyword)}
                            onCheckedChange={(c) => {
                              const next = new Set(selected);
                              if (c) next.add(i.keyword);
                              else next.delete(i.keyword);
                              setSelected(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{i.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(i.searchVolume)}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-2">
                            <span className="tabular-nums">{i.difficulty}</span>
                            <Badge variant={kd.variant}>{kd.label}</Badge>
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(i.cpc)}</TableCell>
                        <TableCell className="text-right tabular-nums">{i.competition.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getIntentLabel(i.intent)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
