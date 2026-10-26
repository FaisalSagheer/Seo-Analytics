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
