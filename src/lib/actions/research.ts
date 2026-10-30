"use server";

import { denied, requireProject } from "@/lib/session";
import { cached, getSeoProvider } from "@/lib/providers";
import { domainLookupSchema, keywordIdeasSchema, type DomainLookupInput, type KeywordIdeasInput } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";
import type { BacklinkSummary, DomainMetrics, KeywordIdea, TopPageRow } from "@/lib/types";

export async function lookupKeywordIdeas(input: KeywordIdeasInput): Promise<ActionResult<KeywordIdea[]>> {
  const blocked = await denied("research.use");
  if (blocked) return blocked;
  const parsed = keywordIdeasSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  try {
    const provider = await getSeoProvider(project);
    const { seeds, locationCode, languageCode, limit } = parsed.data;
    // Paid lookup: cache a day so repeat searches cost nothing
    const ideas = await cached(["ideas", provider.name, seeds, locationCode, languageCode, limit], 24, () =>
      provider.keywordIdeas({ seeds, locationCode, languageCode, limit }),
    );
    return ok(ideas);
  } catch (err) {
    return fail(err);
  }
}

export type DomainLookup = { domain: string; metrics: DomainMetrics; backlinks: BacklinkSummary; pages: TopPageRow[] };

export async function lookupDomain(input: DomainLookupInput): Promise<ActionResult<DomainLookup>> {
  const blocked = await denied("research.use");
  if (blocked) return blocked;
  const parsed = domainLookupSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  try {
    const provider = await getSeoProvider(project);
    const domain = parsed.data.domain;
    const market = { locationCode: project.locationCode, languageCode: project.languageCode };
    const data = await cached(["domain", provider.name, domain, market], 24, async () => {
      const [metrics, backlinks, pages] = await Promise.all([
        provider.domainOverview({ ...market, domain }),
        provider.backlinkSummary({ domain }),
        provider.topPages({ ...market, domain, limit: 20 }),
      ]);
      return { domain, metrics, backlinks, pages };
    });
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
