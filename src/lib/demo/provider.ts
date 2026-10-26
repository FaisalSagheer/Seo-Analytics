import type { BacklinkRow, KeywordIdea, SearchIntent, SeoProvider, TopPageRow } from "@/lib/types";
import { hashString, rng } from "@/lib/demo/random";

const MODIFIERS = [
  "best", "free", "cheap", "online", "tool", "software", "for beginners", "near me", "vs", "alternatives",
  "pricing", "review", "how to", "what is", "template", "examples", "guide", "2026", "api", "checker",
];
const INTENTS: SearchIntent[] = ["informational", "commercial", "transactional", "navigational"];
const REFERRERS = [
  "techcrunch.com", "medium.com", "dev.to", "reddit.com", "producthunt.com", "searchengineland.com",
  "moz.com", "news.ycombinator.com", "github.com", "indiehackers.com", "smashingmagazine.com",
  "css-tricks.com", "hubspot.com", "wordpress.org", "stackoverflow.com", "forbes.com", "wired.com",
  "theverge.com", "zapier.com", "notion.so", "substack.com", "quora.com", "youtube.com", "linkedin.com",
];
const PAGE_SLUGS = [
  "", "pricing", "blog/seo-checklist", "blog/keyword-research-guide", "features/rank-tracker",
  "blog/backlink-audit", "tools/serp-checker", "docs/api", "blog/technical-seo", "compare/alternatives",
  "blog/local-seo", "templates/content-brief", "about", "blog/core-web-vitals", "features/site-audit",
];

/** Day number so ranks drift day by day but stay stable within a day. */
function dayIndex(d = new Date()) {
  return Math.floor(d.getTime() / 86_400_000);
}

/**
 * A keyword's demo position on a given day: a stable base rank plus a slow
 * trend and some noise. Shared by the provider and the seed.
 */
export function demoPosition(keyword: string, day: number): number | null {
  const r = rng(`base:${keyword}`);
  const base = r.int(4, 55);
  // A slow wave (months) for the trend and a faster one (weeks) for churn,
  // so the history is smooth and bounded rather than a random walk.
  const slow = r.float(4, 14) * Math.sin(day / r.float(40, 90) + r.float(0, 6.28));
  const fast = r.float(1, 4) * Math.sin(day / r.float(5, 12) + r.float(0, 6.28));
  const noise = rng(`d:${keyword}:${day}`).float(-1.5, 1.5);
  const pos = Math.round(base + slow + fast + noise);
  if (pos > 100) return null;
  return Math.max(1, pos);
}

export function demoVolume(keyword: string) {
  const r = rng(`vol:${keyword}`);
  return Math.round(Math.pow(10, r.float(1.6, 4.6)) / 10) * 10;
}

export const demoProvider: SeoProvider = {
  name: "demo",

  async checkRank({ keyword, domain }) {
    const position = demoPosition(keyword, dayIndex());
    const slug = PAGE_SLUGS[hashString(keyword) % PAGE_SLUGS.length];
    return { position, url: position ? `https://${domain}/${slug}` : null };
  },

  async keywordIdeas({ seeds, limit }) {
    const out: KeywordIdea[] = [];
    const seen = new Set<string>();
    for (const seed of seeds) {
      const base = seed.trim().toLowerCase();
      if (!base) continue;
      const variants = [base, ...MODIFIERS.map((m, i) => (i % 2 ? `${base} ${m}` : `${m} ${base}`))];
      for (const kw of variants) {
        if (seen.has(kw)) continue;
        seen.add(kw);
        const r = rng(`idea:${kw}`);
        out.push({
          keyword: kw,
          searchVolume: demoVolume(kw),
          cpc: Number(r.float(0.2, 14).toFixed(2)),
          competition: Number(r.float(0, 1).toFixed(2)),
          difficulty: r.int(4, 92),
          intent: r.pick(INTENTS),
        });
      }
    }
    return out.sort((a, b) => b.searchVolume - a.searchVolume).slice(0, limit);
  },

  async domainOverview({ domain }) {
    const r = rng(`dom:${domain}:${dayIndex()}`);
    const keywords = 1800 + (hashString(domain) % 4000) + r.int(-40, 40);
    return {
      organicKeywords: keywords,
      organicTraffic: Math.round(keywords * r.float(4.5, 5.5)),
      trafficCost: Math.round(keywords * r.float(6, 8)),
      pos1: Math.round(keywords * 0.04),
      pos2to3: Math.round(keywords * 0.07),
      pos4to10: Math.round(keywords * 0.19),
    };
  },

  async topPages({ domain, limit }) {
    return PAGE_SLUGS.slice(0, limit).map<TopPageRow>((slug, i) => {
      const r = rng(`page:${domain}:${slug}`);
      return {
        url: `https://${domain}/${slug}`,
        traffic: Math.round(9000 / (i + 1) + r.int(0, 400)),
        keywords: Math.round(600 / (i + 1) + r.int(5, 60)),
        pos1: Math.max(0, Math.round(40 / (i + 1)) - r.int(0, 3)),
      };
    });
  },

  async backlinkSummary({ domain }) {
    const r = rng(`bls:${domain}`);
    return {
      backlinks: r.int(9_000, 42_000),
      referringDomains: r.int(600, 2_400),
      domainRank: r.int(38, 71),
      brokenBacklinks: r.int(20, 300),
      referringIps: r.int(500, 2_000),
      nofollowDomains: r.int(80, 400),
    };
  },

  async backlinks({ domain, limit }) {
    const now = Date.now();
    return Array.from({ length: Math.min(limit, 120) }, (_, i) => {
      const r = rng(`bl:${domain}:${i}`);
      const from = r.pick(REFERRERS);
      const first = now - r.int(5, 900) * 86_400_000;
      const isLost = r.bool(0.08);
      return {
        urlFrom: `https://${from}/${r.pick(["post", "article", "p", "story", "t"])}/${hashString(`${from}${i}`).toString(36)}`,
        urlTo: `https://${domain}/${r.pick(PAGE_SLUGS)}`,
        domainFrom: from,
        anchor: r.pick([domain, "this tool", "rank tracker", "SEO dashboard", "click here", "keyword research", "read more", ""]),
        dofollow: r.bool(0.72),
        domainFromRank: r.int(20, 95),
        firstSeen: new Date(first),
        lastSeen: new Date(isLost ? first + r.int(30, 200) * 86_400_000 : now - r.int(0, 6) * 86_400_000),
        isNew: now - first < 30 * 86_400_000,
        isLost,
      } satisfies BacklinkRow;
    }).sort((a, b) => b.domainFromRank - a.domainFromRank);
  },
};
