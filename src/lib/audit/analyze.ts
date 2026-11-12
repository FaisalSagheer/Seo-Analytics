import * as cheerio from "cheerio";
import type { IssueCode } from "@/lib/audit/issues";

export type PageAnalysis = {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  canonical: string | null;
  wordCount: number;
  /** Absolute http(s) links found on the page, fragments removed */
  links: string[];
  internalLinks: number;
  externalLinks: number;
  /** Issues detectable from this page alone; cross-page ones (duplicates, broken links) are added later */
  issues: IssueCode[];
};

const NON_PAGE_EXT = /\.(?:jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|gz|rar|mp[34]|mov|avi|css|js|json|xml|txt|woff2?|ttf|eot|docx?|xlsx?|pptx?)$/i;

export function stripWww(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Dedup key: scheme-agnostic, www-agnostic, no fragment, no trailing slash. */
export function urlKey(url: URL) {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${stripWww(url.hostname)}${url.port ? `:${url.port}` : ""}${path}${url.search}`;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

export function analyzePage(html: string, pageUrl: string, siteHost: string): PageAnalysis {
  const $ = cheerio.load(html);
  const base = new URL(pageUrl);
  const issues: IssueCode[] = [];

  const title = clean($("head > title").first().text() || $("title").first().text()) || null;
  const metaDescription = clean($('meta[name="description" i]').attr("content")) || null;
  const h1s = $("h1");
  const h1 = clean(h1s.first().text()) || null;
  const canonicalHref = $('link[rel="canonical" i]').attr("href");
  let canonical: string | null = null;
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, base).toString();
    } catch {
      canonical = null;
    }
  }

  const robots = clean($('meta[name="robots" i]').attr("content")).toLowerCase();
  const noindex = /\bnoindex\b/.test(robots) || /\bnone\b/.test(robots);

  const links = new Set<string>();
  let internalLinks = 0;
  let externalLinks = 0;
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || /^(?:#|mailto:|tel:|javascript:|data:|sms:)/i.test(href)) return;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    u.hash = "";
    if (stripWww(u.hostname) === siteHost) {
      internalLinks++;
      if (!NON_PAGE_EXT.test(u.pathname)) links.add(u.toString());
    } else {
      externalLinks++;
    }
  });

  // Visible text word count: drop non-content elements first
  $("script, style, noscript, template, svg, nav, footer, header").remove();
  const text = clean($("body").text());
  const wordCount = text ? text.split(" ").length : 0;

  const imagesMissingAlt = $("img").filter((_, el) => $(el).attr("alt") === undefined).length;

  if (!title) issues.push("MISSING_TITLE");
  else if (title.length < 30) issues.push("TITLE_TOO_SHORT");
  else if (title.length > 60) issues.push("TITLE_TOO_LONG");

  if (!metaDescription) issues.push("MISSING_META_DESCRIPTION");
  else if (metaDescription.length < 70) issues.push("META_DESCRIPTION_TOO_SHORT");
  else if (metaDescription.length > 160) issues.push("META_DESCRIPTION_TOO_LONG");

  if (h1s.length === 0) issues.push("MISSING_H1");
  else if (h1s.length > 1) issues.push("MULTIPLE_H1");

  if (!canonical) issues.push("MISSING_CANONICAL");
  if (noindex) issues.push("NOINDEX");
  if (wordCount < 300) issues.push("THIN_CONTENT");
  if (imagesMissingAlt > 0) issues.push("IMAGES_MISSING_ALT");
  if (!$('meta[name="viewport" i]').length) issues.push("MISSING_VIEWPORT");
  if (!clean($("html").attr("lang"))) issues.push("MISSING_LANG");
  if (base.protocol !== "https:") issues.push("NOT_HTTPS");

  return { title, metaDescription, h1, h1Count: h1s.length, canonical, wordCount, links: [...links], internalLinks, externalLinks, issues };
}
