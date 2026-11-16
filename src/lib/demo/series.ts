import { hashString, rng } from "@/lib/demo/random";

/** Demo Search Console + GA4 numbers for one day. Weekly rhythm + slow growth + noise. */
export function demoTraffic(domain: string, date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const base = 380 + (hashString(domain) % 300);
  const weekday = date.getUTCDay();
  const weekly = weekday === 0 || weekday === 6 ? 0.72 : 1.05;
  const growth = 1 + 0.25 * Math.sin(day / 70);
  const r = rng(`traffic:${domain}:${day}`);
  const clicks = Math.round(base * weekly * growth * r.float(0.88, 1.12));
  const impressions = Math.round(clicks * r.float(26, 34));
  const sessions = Math.round(clicks * r.float(1.08, 1.25));
  return {
    gsc: {
      clicks,
      impressions,
      ctr: clicks / impressions,
      position: Number((14 - 3 * Math.sin(day / 70) + r.float(-0.8, 0.8)).toFixed(1)),
    },
    ga4: {
      sessions,
      users: Math.round(sessions * r.float(0.8, 0.9)),
      conversions: Math.round(sessions * r.float(0.018, 0.032)),
      engagementRate: Number(r.float(0.55, 0.68).toFixed(3)),
    },
  };
}

export const DEMO_QUERIES = [
  "seo dashboard", "rank tracker", "open source seo tool", "keyword rank checker", "backlink checker free",
  "google ranking tracker", "serp tracker", "self hosted seo", "seo reporting tool", "keyword research tool",
  "track keyword positions", "domain authority checker", "search console dashboard", "ga4 seo report",
  "organic traffic report", "seo api", "rank tracking api", "competitor keyword analysis", "seo audit tool",
  "local rank tracker",
];

export const DEMO_KEYWORDS: { phrase: string; tags: string }[] = [
  { phrase: "seo dashboard", tags: "core" },
  { phrase: "rank tracker", tags: "core" },
  { phrase: "open source seo tool", tags: "core,open-source" },
  { phrase: "keyword rank checker", tags: "tools" },
  { phrase: "backlink checker free", tags: "tools,backlinks" },
  { phrase: "google ranking tracker", tags: "core" },
  { phrase: "serp tracker", tags: "tools" },
  { phrase: "self hosted seo", tags: "open-source" },
  { phrase: "seo reporting tool", tags: "reporting" },
  { phrase: "keyword research tool", tags: "tools" },
  { phrase: "track keyword positions", tags: "core" },
  { phrase: "domain authority checker", tags: "backlinks" },
  { phrase: "search console dashboard", tags: "reporting" },
  { phrase: "ga4 seo report", tags: "reporting" },
  { phrase: "seo api", tags: "api" },
  { phrase: "rank tracking api", tags: "api" },
  { phrase: "competitor keyword analysis", tags: "tools" },
  { phrase: "local rank tracker", tags: "local" },
  { phrase: "seo audit tool", tags: "tools" },
  { phrase: "best rank tracker 2026", tags: "core,commercial" },
];

const DEMO_REFERRERS = [
  "news.ycombinator.com", "reddit.com", "medium.com", "dev.to", "producthunt.com", "github.com",
  "indiehackers.com", "smashingmagazine.com", "searchengineland.com", "moz.com", "hubspot.com", "forbes.com",
];
const DEMO_REFERRER_PATHS = ["", "r/seo/comments/", "posts/", "blog/", "launch/", "articles/", "item?id=", "resources/", "news/", "guides/"];

/**
 * Demo referral traffic for one day. Most sites send visits all the time, two only began
 * in the last couple of weeks and one stopped a month ago, so the "new" and "gone" views
 * have something to show.
 */
export function demoReferrals(domain: string, date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const today = Math.floor(Date.now() / 86_400_000);
  const weekday = date.getUTCDay();
  const weekly = weekday === 0 || weekday === 6 ? 0.6 : 1.1;
  return DEMO_REFERRERS.flatMap((source, i) => {
    const age = today - day; // days ago
    if (i === 8 && age > 12) return [];
    if (i === 9 && age > 6) return [];
    if (i === 10 && age < 35) return [];
    const r = rng(`ref:${domain}:${source}:${day}`);
    if (i === 11 && !r.bool(0.35)) return [];
    const sessions = Math.max(1, Math.round((70 / (i + 1.5)) * weekly * r.float(0.7, 1.3)));
    return [{ source, sessions, users: Math.max(1, Math.round(sessions * r.float(0.75, 0.95))), conversions: r.bool(0.18) ? 1 : 0 }];
  });
}

/** Demo referring pages for the last 28 days. */
export function demoReferralPages(domain: string) {
  return DEMO_REFERRERS.slice(0, 10).flatMap((source, i) =>
    [0, 1, 2].slice(0, i < 4 ? 3 : 1).map((n) => {
      const r = rng(`refp:${domain}:${source}:${n}`);
      const sessions = Math.max(2, Math.round((900 / (i + 1)) / (n + 1) * r.float(0.8, 1.2)));
      return {
        referrer: `https://${source}/${DEMO_REFERRER_PATHS[(i + n) % DEMO_REFERRER_PATHS.length]}${hashString(`${source}${n}`).toString(36)}`,
        source,
        sessions,
        users: Math.max(1, Math.round(sessions * 0.85)),
      };
    }),
  );
}

const DEMO_LINK_SITES = [
  "searchenginejournal.com", "moz.com", "ahrefs.com", "backlinko.com", "hubspot.com", "reddit.com", "medium.com", "dev.to",
  "producthunt.com", "indiehackers.com", "news.ycombinator.com", "github.com", "wikipedia.org", "quora.com", "linkedin.com",
  "smashingmagazine.com", "css-tricks.com", "sitepoint.com", "digitalocean.com", "freecodecamp.org",
];
const DEMO_LINK_TEXT = ["Seo Engine", "demo site", "seo tool", "click here", "this guide", "read more", "https://demo.seoengine.example", "keyword tracking", "free seo dashboard"];
const DEMO_LINK_PATHS = ["", "pricing", "blog/seo-basics", "blog/keyword-research", "features", "docs", "blog/site-audit", "about"];

/**
 * Three demo uploads of Search Console's Links export, about two months apart,
 * so the page shows growth, new sites and a lost site.
 */
export function demoLinkImports(domain: string) {
  return [60, 30, 0].map((daysAgo, step) => {
    const count = 14 + step * 2;
    // the last upload gains sites at the end and drops the first two, so both new and lost sites show
    const sites = DEMO_LINK_SITES.slice(step === 2 ? 2 : 0, step === 2 ? count + 2 : count);
    return {
      daysAgo,
      sites: sites.map((label, i) => {
        const r = rng(`links:${domain}:${label}:${step}`);
        return { label, links: Math.max(1, Math.round(120 / (i + 1) * r.float(0.8, 1.3)) + step * 2), related: r.int(1, 6) };
      }),
      pages: DEMO_LINK_PATHS.map((p, i) => {
        const r = rng(`linkp:${domain}:${p}:${step}`);
        return { label: `https://${domain}/${p}`, links: Math.max(2, Math.round(300 / (i + 1) * r.float(0.8, 1.2)) + step * 5), related: r.int(2, 14) };
      }),
      texts: DEMO_LINK_TEXT.map((label, i) => {
        const r = rng(`linkt:${domain}:${label}:${step}`);
        return { label, links: Math.max(1, Math.round(200 / (i + 1) * r.float(0.8, 1.2))) };
      }),
    };
  });
}
