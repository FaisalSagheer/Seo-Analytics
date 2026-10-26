import "server-only";
import { bareDomain } from "@/lib/domain";
import type { BacklinkRow } from "@/lib/types";

/**
 * Bing Webmaster Tools API (free, your verified sites only).
 * GET https://ssl.bing.com/webmaster/api.svc/json/<Method>?...&apikey=KEY, result under `d`.
 */
const BASE = "https://ssl.bing.com/webmaster/api.svc/json";
const TIMEOUT_MS = 30_000;
// Bing paginates both lists; caps keep one sync to a few dozen requests
const MAX_COUNT_PAGES = 10;
const MAX_TARGET_PAGES = 25;
const MAX_LINKS = 500;

export class BingError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "BingError";
  }
}

async function call<T>(apiKey: string, method: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), apikey: apiKey });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${method}?${qs}`, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) throw new BingError("Bing rejected the API key", res.status);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { Message?: string } | null;
      // Bing reports a bad key as a 400 with "ERROR!!! InvalidApiKey"
      if (body?.Message?.includes("InvalidApiKey")) throw new BingError("Bing rejected the API key", res.status);
      throw new BingError(body?.Message ?? `Bing Webmaster API returned ${res.status}`, res.status);
    }
    return ((await res.json()) as { d: T }).d;
  } finally {
    clearTimeout(timer);
  }
}

export async function listBingSites(apiKey: string): Promise<string[]> {
  const sites = await call<{ Url: string; IsVerified: boolean }[]>(apiKey, "GetUserSites");
  return (sites ?? []).filter((s) => s.IsVerified).map((s) => s.Url);
}

type LinkCounts = { Links?: { Url: string; Count: number }[]; TotalPages?: number };
type LinkDetails = { Details?: { AnchorText?: string; Url: string }[]; TotalPages?: number };

async function urlLinks(apiKey: string, siteUrl: string, link: string, page: number) {
  try {
    return await call<LinkDetails>(apiKey, "GetUrlLinks", { siteUrl, link, page });
  } catch (err) {
    // Bing's JSON sample passes `link` as a JSON-encoded string; fall back to that form
    if (err instanceof BingError && err.status === 400) {
      return call<LinkDetails>(apiKey, "GetUrlLinks", { siteUrl, link: JSON.stringify(link), page });
    }
    throw err;
  }
}

/**
 * Inbound links to a verified site. `total` is Bing's own count across all
 * pages; `links` is the detailed sample (capped), spread over the most-linked pages.
 */
export async function fetchBingBacklinks(apiKey: string, siteUrl: string) {
  const counts: { Url: string; Count: number }[] = [];
  for (let page = 0; page < MAX_COUNT_PAGES; page++) {
    const r = await call<LinkCounts>(apiKey, "GetLinkCounts", { siteUrl, page });
    counts.push(...(r.Links ?? []));
    if (page + 1 >= (r.TotalPages ?? 0)) break;
  }
  const total = counts.reduce((s, c) => s + c.Count, 0);

  const links: BacklinkRow[] = [];
  const targets = [...counts].sort((a, b) => b.Count - a.Count).slice(0, MAX_TARGET_PAGES);
  for (const target of targets) {
    if (links.length >= MAX_LINKS) break;
    const r = await urlLinks(apiKey, siteUrl, target.Url, 0);
    for (const d of r.Details ?? []) {
      if (links.length >= MAX_LINKS) break;
      links.push({
        urlFrom: d.Url,
        urlTo: target.Url,
        domainFrom: bareDomain(d.Url),
        anchor: d.AnchorText ?? "",
        dofollow: null,
        domainFromRank: null,
        firstSeen: null,
        lastSeen: null,
        isNew: false,
        isLost: false,
      });
    }
  }
  return { total, links, referringDomains: new Set(links.map((l) => l.domainFrom)).size };
}
