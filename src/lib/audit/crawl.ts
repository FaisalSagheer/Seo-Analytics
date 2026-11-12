import "server-only";
import { analyzePage, stripWww, urlKey } from "@/lib/audit/analyze";
import { fetchPage, type FetchOptions } from "@/lib/audit/fetcher";
import { isAllowed, parseRobots, type RobotsRules } from "@/lib/audit/robots";
import { severityOf, type IssueCode } from "@/lib/audit/issues";

export type CrawledPage = {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  canonical: string | null;
  wordCount: number;
  loadMs: number;
  internalLinks: number;
  externalLinks: number;
  issues: IssueCode[];
};

export type CrawlResult = { startUrl: string; pages: CrawledPage[]; siteIssues: IssueCode[]; truncated: boolean };

export type CrawlOptions = FetchOptions & {
  maxPages?: number;
  concurrency?: number;
  /** Overall time budget; the crawl stops queueing new pages after this */
  deadlineMs?: number;
};

export const DEFAULT_MAX_PAGES = 50;

const isHtml = (contentType: string) => /html|xml/i.test(contentType);

async function tryFetch(url: string, opts: FetchOptions) {
  try {
    return await fetchPage(url, opts);
  } catch {
    return null;
  }
}

/** Sitemap <loc> URLs, following one level of sitemap index. Returns null when no sitemap exists. */
async function readSitemap(urls: string[], opts: FetchOptions): Promise<string[] | null> {
  const found: string[] = [];
  let exists = false;
  for (const sitemapUrl of urls) {
    const res = await tryFetch(sitemapUrl, opts);
    if (!res || res.status !== 200 || !/<(?:urlset|sitemapindex)[\s>]/i.test(res.body)) continue;
    exists = true;
    const locs = [...res.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&"));
    if (/<sitemapindex[\s>]/i.test(res.body)) {
      for (const child of locs.slice(0, 3)) {
        const c = await tryFetch(child, opts);
        if (c?.status === 200) found.push(...[...c.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, "&")));
      }
    } else {
      found.push(...locs);
    }
    if (found.length > 500) break;
  }
  return exists ? found : null;
}

/** 0–100: pages with errors weigh most, then warnings; site-wide errors cost a flat 5 each. */
export function auditScore(pages: Pick<CrawledPage, "issues">[], siteIssues: IssueCode[]) {
  if (pages.length === 0) return 0;
  let errorPages = 0;
  let warningPages = 0;
  for (const p of pages) {
    const sev = p.issues.map(severityOf);
    if (sev.includes("error")) errorPages++;
    else if (sev.includes("warning")) warningPages++;
  }
  const siteErrors = siteIssues.filter((c) => severityOf(c) === "error").length;
  const raw = 100 - (60 * errorPages) / pages.length - (40 * warningPages) / pages.length - 5 * siteErrors;
  return Math.max(0, Math.round(raw));
}

export async function crawlSite(domain: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const { maxPages = DEFAULT_MAX_PAGES, concurrency = 4, deadlineMs = 90_000, ...fetchOpts } = options;
  const deadline = Date.now() + deadlineMs;
  const siteHost = stripWww(new URL(`http://${domain}`).hostname);

  // Prefer https; fall back to http so a site without TLS still gets audited (and flagged)
  let first = await tryFetch(`https://${domain}/`, fetchOpts);
  if (!first) first = await tryFetch(`http://${domain}/`, fetchOpts);
  if (!first) throw new Error(`Couldn't reach ${domain}. Check the domain and that the site is online.`);
  const origin = new URL(first.url).origin;
  const startUrl = first.url;

  // Site-wide files
  const siteIssues: IssueCode[] = [];
  const robotsRes = await tryFetch(`${origin}/robots.txt`, fetchOpts);
  let robots: RobotsRules = { rules: [], sitemaps: [], blocksAll: false };
  if (robotsRes?.status === 200 && !/<html[\s>]/i.test(robotsRes.body)) {
    robots = parseRobots(robotsRes.body);
    if (robots.blocksAll) siteIssues.push("ROBOTS_BLOCKS_ALL");
  } else {
    siteIssues.push("ROBOTS_MISSING");
  }
  const sitemapUrls = await readSitemap(robots.sitemaps.length ? robots.sitemaps : [`${origin}/sitemap.xml`], fetchOpts);
  if (sitemapUrls === null) siteIssues.push("SITEMAP_MISSING");

  // Queue: homepage links first, sitemap URLs after
  const seen = new Set<string>();
  const queue: string[] = [];
  const enqueue = (raw: string, isStart = false) => {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return;
    }
    if (stripWww(u.hostname) !== siteHost || (u.protocol !== "http:" && u.protocol !== "https:")) return;
    u.hash = "";
    const key = urlKey(u);
    if (seen.has(key)) return;
    if (!isStart && !isAllowed(robots, u.pathname + u.search)) return;
    seen.add(key);
    queue.push(u.toString());
  };

  const pages: CrawledPage[] = [];
  const linkTargets = new Map<string, string[]>(); // page url -> internal link keys
  const statusByKey = new Map<string, number>();
  let truncated = false;

  const record = (res: { url: string; status: number; ms: number; body: string; contentType: string }) => {
    const finalUrl = new URL(res.url);
    const key = urlKey(finalUrl);
    statusByKey.set(key, res.status);
    seen.add(key);
    if (res.status >= 400) {
      pages.push({
        url: res.url, statusCode: res.status, title: null, metaDescription: null, h1: null, h1Count: 0, canonical: null,
        wordCount: 0, loadMs: res.ms, internalLinks: 0, externalLinks: 0, issues: [res.status >= 500 ? "HTTP_5XX" : "HTTP_4XX"],
      });
      return [] as string[];
    }
    if (!isHtml(res.contentType)) return [] as string[]; // image, pdf, ...: not a page
    const a = analyzePage(res.body, res.url, siteHost);
    const issues = [...a.issues];
    if (res.ms > 2000) issues.push("SLOW_PAGE");
    pages.push({
      url: res.url, statusCode: res.status, title: a.title, metaDescription: a.metaDescription, h1: a.h1, h1Count: a.h1Count,
      canonical: a.canonical, wordCount: a.wordCount, loadMs: res.ms, internalLinks: a.internalLinks, externalLinks: a.externalLinks, issues,
    });
    linkTargets.set(res.url, a.links.map((l) => urlKey(new URL(l))));
    return a.links;
  };

  // Homepage is already fetched: record it and queue what it links to
  seen.add(urlKey(new URL(startUrl)));
  for (const link of record(first)) enqueue(link);
  for (const u of sitemapUrls ?? []) enqueue(u);

  let inFlight = 0;
  await new Promise<void>((resolve) => {
    const pump = () => {
      while (inFlight < concurrency && queue.length > 0 && pages.length + inFlight < maxPages && Date.now() < deadline) {
        const url = queue.shift()!;
        inFlight++;
        fetchPage(url, fetchOpts)
          .then((res) => {
            const links = record(res);
            for (const l of links) enqueue(l);
          })
          .catch(() => {
            statusByKey.set(urlKey(new URL(url)), 0);
            pages.push({
              url, statusCode: 0, title: null, metaDescription: null, h1: null, h1Count: 0, canonical: null,
              wordCount: 0, loadMs: 0, internalLinks: 0, externalLinks: 0, issues: ["FETCH_FAILED"],
            });
          })
          .finally(() => {
            inFlight--;
            pump();
          });
      }
      if (inFlight === 0) {
        truncated = queue.length > 0;
        resolve();
      }
    };
    pump();
  });

  // Cross-page checks
  const count = (pick: (p: CrawledPage) => string | null) => {
    const m = new Map<string, number>();
    for (const p of pages) {
      const v = pick(p)?.toLowerCase();
      if (v && p.statusCode < 400) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return m;
  };
  const titles = count((p) => p.title);
  const descs = count((p) => p.metaDescription);
  for (const p of pages) {
    if (p.title && (titles.get(p.title.toLowerCase()) ?? 0) > 1) p.issues.push("DUPLICATE_TITLE");
    if (p.metaDescription && (descs.get(p.metaDescription.toLowerCase()) ?? 0) > 1) p.issues.push("DUPLICATE_META_DESCRIPTION");
    const targets = linkTargets.get(p.url) ?? [];
    if (targets.some((k) => (statusByKey.get(k) ?? 200) >= 400 || statusByKey.get(k) === 0)) p.issues.push("BROKEN_LINKS");
  }

  return { startUrl, pages, siteIssues, truncated };
}
