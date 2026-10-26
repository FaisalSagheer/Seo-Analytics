import "server-only";
import { bareDomain } from "@/lib/domain";
import { countryCode } from "@/lib/markets";
import type { RankCheckInput, RankCheckResult } from "@/lib/types";

const ENDPOINT = "https://google.serper.dev/search";
const TIMEOUT_MS = 30_000;
const PAGE_SIZE = 10;

export const SERPER_DEPTHS = [10, 20, 30, 50, 100] as const;
export const DEFAULT_SERPER_DEPTH = 50;

export class SerperError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SerperError";
  }
}

type SerperPage = { organic?: { link?: string; position?: number }[] };

async function searchPage(apiKey: string, body: Record<string, unknown>): Promise<SerperPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new SerperError("Serper rejected the API key", res.status);
    if (res.status === 429) throw new SerperError("Serper rate limit or credits exhausted", res.status);
    if (!res.ok) throw new SerperError(`Serper returned ${res.status}`, res.status);
    return (await res.json()) as SerperPage;
  } finally {
    clearTimeout(timer);
  }
}

function hostMatches(link: string, target: string) {
  const host = bareDomain(link);
  return host === target || host.endsWith(`.${target}`);
}

/**
 * Google no longer serves 100 results per page, so a top-100 check is up to
 * ten requests and each costs a Serper credit. Pages are fetched in order and
 * the check stops at the first hit, so ranked keywords cost only what they need;
 * `maxDepth` caps the cost of keywords that don't rank.
 */
export function createSerperRankChecker(apiKey: string, maxDepth: number) {
  const pages = Math.max(1, Math.ceil(Math.min(100, maxDepth) / PAGE_SIZE));

  return async function checkRank({ keyword, domain, locationCode, languageCode }: RankCheckInput): Promise<RankCheckResult> {
    const gl = countryCode(locationCode);
    if (!gl) throw new SerperError(`Location ${locationCode} has no country mapping for Serper. Use DataForSEO for this project.`);
    const target = bareDomain(domain);
    // Absolute rank = organic results seen on earlier pages + index on this one.
    // Counting ourselves avoids depending on whether Serper's `position` resets per page.
    let seen = 0;
    for (let page = 1; page <= pages; page++) {
      const r = await searchPage(apiKey, { q: keyword, gl, hl: languageCode, page });
      const organic = r.organic ?? [];
      const idx = organic.findIndex((o) => o.link && hostMatches(o.link, target));
      if (idx >= 0) return { position: seen + idx + 1, url: organic[idx].link ?? null };
      // An empty or short page means Google has nothing further
      if (organic.length === 0) break;
      seen += organic.length;
    }
    return { position: null, url: null };
  };
}

/** One 1-credit query to confirm the key works before it is stored. */
export async function verifySerperKey(apiKey: string) {
  await searchPage(apiKey, { q: "serper", gl: "us", hl: "en", page: 1 });
}
