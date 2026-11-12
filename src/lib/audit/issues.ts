export type Severity = "error" | "warning" | "notice";

/** Every finding the audit can report. Codes are stored on AuditPage.issues / AuditRun.siteIssues. */
export const ISSUES = {
  // Page: request
  FETCH_FAILED: { severity: "error", label: "Page failed to load", hint: "The request timed out, was refused or returned a non-HTML response." },
  HTTP_4XX: { severity: "error", label: "Broken page (4xx)", hint: "The page returns a client error. Fix or redirect it, and update links pointing to it." },
  HTTP_5XX: { severity: "error", label: "Server error (5xx)", hint: "The server failed to answer. Check your hosting logs." },
  SLOW_PAGE: { severity: "warning", label: "Slow response", hint: "The HTML took over 2 seconds to arrive. Check caching and server speed." },
  // Page: indexability
  NOINDEX: { severity: "warning", label: "Blocked from indexing (noindex)", hint: "A robots meta tag stops search engines indexing this page. Remove it if the page should rank." },
  MISSING_CANONICAL: { severity: "notice", label: "No canonical URL", hint: "Add a rel=canonical link so duplicates consolidate onto one URL." },
  // Page: titles & descriptions
  MISSING_TITLE: { severity: "error", label: "Missing title", hint: "Add a unique <title> describing the page." },
  TITLE_TOO_SHORT: { severity: "warning", label: "Title too short", hint: "Under 30 characters. Use the space to include your target keyword." },
  TITLE_TOO_LONG: { severity: "warning", label: "Title too long", hint: "Over 60 characters. Google will likely truncate it." },
  DUPLICATE_TITLE: { severity: "warning", label: "Duplicate title", hint: "Another page uses the same title. Give each page a unique one." },
  MISSING_META_DESCRIPTION: { severity: "warning", label: "Missing meta description", hint: "Add a 70–160 character summary; it is often shown in results." },
  META_DESCRIPTION_TOO_SHORT: { severity: "notice", label: "Meta description too short", hint: "Under 70 characters." },
  META_DESCRIPTION_TOO_LONG: { severity: "notice", label: "Meta description too long", hint: "Over 160 characters. It will likely be truncated." },
  DUPLICATE_META_DESCRIPTION: { severity: "notice", label: "Duplicate meta description", hint: "Another page uses the same description." },
  // Page: content
  MISSING_H1: { severity: "error", label: "Missing H1", hint: "Add one H1 heading that states the page topic." },
  MULTIPLE_H1: { severity: "warning", label: "Multiple H1 headings", hint: "Use a single H1 and H2–H6 for sub-sections." },
  THIN_CONTENT: { severity: "warning", label: "Thin content", hint: "Under 300 words of text." },
  IMAGES_MISSING_ALT: { severity: "warning", label: "Images without alt text", hint: "Add descriptive alt attributes for accessibility and image search." },
  BROKEN_LINKS: { severity: "error", label: "Links to broken pages", hint: "This page links to internal URLs that failed to load." },
  // Page: technical
  MISSING_VIEWPORT: { severity: "warning", label: "No mobile viewport", hint: "Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">." },
  MISSING_LANG: { severity: "notice", label: "No html lang attribute", hint: "Add lang=\"en\" (or your language) to the <html> tag." },
  NOT_HTTPS: { severity: "error", label: "Not served over HTTPS", hint: "Redirect all HTTP traffic to HTTPS." },
  // Site-wide
  ROBOTS_MISSING: { severity: "notice", label: "No robots.txt", hint: "Add /robots.txt and reference your sitemap in it." },
  ROBOTS_BLOCKS_ALL: { severity: "error", label: "robots.txt blocks the whole site", hint: "A \"Disallow: /\" rule for all crawlers keeps search engines out." },
  SITEMAP_MISSING: { severity: "warning", label: "No XML sitemap", hint: "Add /sitemap.xml (or list one in robots.txt) so search engines find all pages." },
} as const satisfies Record<string, { severity: Severity; label: string; hint: string }>;

export type IssueCode = keyof typeof ISSUES;

export const SITE_ISSUE_CODES = ["ROBOTS_MISSING", "ROBOTS_BLOCKS_ALL", "SITEMAP_MISSING"] as const satisfies readonly IssueCode[];

export function isIssueCode(value: unknown): value is IssueCode {
  return typeof value === "string" && value in ISSUES;
}

export function severityOf(code: IssueCode): Severity {
  return ISSUES[code].severity;
}
