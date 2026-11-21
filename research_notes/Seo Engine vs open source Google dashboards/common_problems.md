# Common problems with Google data dashboards and APIs (Search Console, GA4, Merchant Center)

Scope: recurring user-reported problems, the fixes projects use, and how Seo Engine compares. Research date 2026-11-21.

Verification limits: the Google developer documentation (developers.google.com) and Search Engine Roundtable were not reachable from this session, so quota numbers, hourly retention and the GA4 quota page are unverified. Most evidence below comes from search-result snippets, GitHub issue titles and vendor blogs. Frequency is judged from how many independent sources report each problem, not from measured counts. Merchant Center forum research was not done.

Codebase references are to `/home/user/Seo-Analytics/src/lib/...` unless stated.

---

## Key question 1: What do users complain about most?

### Takeaway
The most-reported problems are (1) Search Console data arriving late or with gaps, (2) row caps that silently truncate exports, and (3) token expiry or revoked access that forces a reconnect. GA4 complaints are mostly about numbers that do not match Search Console, which is a definition problem rather than an API bug.

### Cited Findings
- Search Console API delays and stalls recur in the trade press, with several separate episodes: [Google Search Console API Is Delayed](https://www.seroundtable.com/google-search-console-api-delayed-36551.html), [Google Search Console API Data Stuck On April 22](https://www.seroundtable.com/google-search-console-api-stuck-39315.html), [Google Search Console API Data Stuck Since June 3rd](https://www.seroundtable.com/google-search-console-api-delayed-39563.html), [Google Search Console Performance Report Stuck At Sunday October 19](https://www.seroundtable.com/google-search-crawl-indexing-timelines-40311.html). (Titles and snippets only; article bodies were not fetched.)
- Fivetran's documentation says data is "missing from the last two to three days" for Search Console and that the API makes data available within two to three days: [Why Is Data Missing From the Last Two to Three Days?](https://fivetran.com/docs/connectors/applications/google-search-console/troubleshooting/data-missing-three-days)
- Row caps cause silent truncation. Fivetran has a knowledge-base article on the 50,000 rows-per-day limit: [Can I Sync More Than 50000 Rows per Day?](https://fivetran.com/docs/connectors/applications/google-search-console/troubleshooting/kb-search-console-rows-per-day-limit). Open-source tooling reports the same problem: [searchConsoleR #48, "Querying one day of data at a time only gives 5000 rows"](https://github.com/MarkEdmondson1234/searchConsoleR/issues/48) (6 comments, open) and [searchConsoleR #43, rowLimit 5000+ download error](https://github.com/MarkEdmondson1234/searchConsoleR/issues/43) (21 comments, open).
- Pagination is a known gap. A guide on export limits and pagination gaps: [Handling Search Console Export Limits and Pagination Gaps](https://www.vincentschmalbach.com/handling-search-console-export-limits-and-pagination-gaps/). Reported details: `rowLimit` maximum 25,000 per request, `startRow` counts from zero, API returns top rows but does not promise all rows, and a page boundary once returned one row twice and skipped another.
- Google's own deep dive on performance data filtering and limits: [A deep dive into Search Console performance data filtering and limits](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive) (surfaced in search; content not fetched, so the 25k/50k figures are from secondary summaries).
- Token and reconnect failures are frequent enough to get issues in open-source projects, for example [xagent #3429: refresh tokens are revoked by Google and never classified as dead](https://github.com/xorbitsai/xagent/issues/3429) (1 comment).
- Mismatched numbers between Search Console and GA4 are a standard question: [SEJ: Ask an SEO: Why is GA4 reporting higher traffic than GSC?](https://www.searchenginejournal.com/ask-an-seo-why-is-ga4-reporting-higher-traffic-than-gsc/547327/). Vendor explanation (search summary only): GSC aggregates by canonical URL, GA4 records the URL loaded in the browser, and sessions and clicks are different units. Also see [Using Search Console and Google Analytics data for SEO](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console) (not fetched).
- GA4 retention limits generate questions but I found no source for an hourly retention limit in the GA4 Data API. Relevant: [GA4 data retention settings](https://support.google.com/analytics/answer/12233314?hl=en) (not fetched) and a Google Ads policy change to 37 months of granular data from June 1, 2026, which is Google Ads, not GA4: [New Data Retention Policy for Google Ads](https://developers.google.com/ads/blog/posts/2026/05/new-data-retention-policy-for-google).
- Search Console delays in 2026: the search results mention a June 2026 page-indexing series stop and a logging error affecting impressions from May 13, 2025 to April 27, 2026 (from Google's data anomalies page, in search summary only, not fetched).

### Inferences
- Lag and gaps are the top complaint. Seo Engine's live Performance page reads Search Console directly, so it inherits Google's lag without any visible "data is N days behind" marker beyond `lastDataAt` (see below).
- Truncation is likely the most damaging silent problem, because the numbers look plausible but are wrong.

### Gaps
- Could not read the Google Search Central community threads or Stack Overflow directly; relied on search summaries.
- Could not measure frequency (no issue counts per topic across trackers).

---

## Key question 2: Problems and fixes, with Seo Engine status

Each problem below lists frequency, what projects do, and the current status in this repo.

### Problem 1: Search Console data is late or missing for the last 2 to 3 days
- **How common:** High. Repeated trade-press reports and vendor docs.
- **Fix in projects:** Treat the last 2 to 3 days as provisional and do not compare them against complete periods. Connectors such as Fivetran document this as expected behaviour. Some tools show a "last data" timestamp.
- **Seo Engine status:** Partial. `src/lib/search-console-live.ts` (line 20) returns `lastDataAt` ("When Search Console last had data for the range (hourly mode only)"). It is only exposed in hourly mode. The daily view has no lag notice. `src/components/dashboard/date-range-dialog.tsx` and `range-picker.tsx` were not inspected for an end-date caveat.
- **Gap:** A daily-mode "data through <date>" notice, and a check that the default end date is not today.

### Problem 2: Row caps silently truncate results (25k per request, 50k per day per property and search type)
- **How common:** High for large sites. Multiple open-source issues and a vendor KB.
- **Fix in projects:** Paginate with `startRow` until a page returns fewer rows than `rowLimit`, deduplicate across page boundaries, or use the BigQuery bulk export for full data (it has no history before setup and no anonymised query text).
- **Seo Engine status:** Not handled. `src/lib/providers/google.ts` sends `rowLimit: 25_000` (lines 100, 122, 204) and has no `startRow` loop (grep for `startRow` in that file returned nothing). Any query with more than 25,000 rows, such as page x query for a large site, returns a truncated answer with no warning. Rank-history queries use `rowLimit: 1000` (line 135).
- **Recommended fix:** Add a paging loop around `gscDaily` / `gscQueries`, or report `truncated: true` when the row count equals the limit. Check that the sync dedup key behaves at page boundaries.

### Problem 3: Hourly Search Console data only covers a short window
- **How common:** Medium. Mentioned in the code's own comments; I could not find a 2026 external source with the exact window.
- **Fix in projects:** Keep the hourly window short and tell the user when a range is outside it.
- **Seo Engine status:** Handled, but only by comment. `search-console-live.ts` line 25 says "Search Console keeps hourly data for about 10 days; stay well inside that." `google.ts` line 114 says "only the last few days." These two comments disagree. The code does not appear to clamp the range or show an error when the range is too old. Verify the actual window against Google's docs (not reachable here).
- **Gap:** Reconcile the two comments and verify the window. Clamp or show a notice for ranges outside it.

### Problem 4: OAuth token expiry, revocation and reconnect
- **How common:** High. Commonly reported across open-source connectors (for example xagent #3429).
- **Fix in projects:** Refresh before expiry, mark the connection as dead on `invalid_grant`, and show a clear reconnect message.
- **Seo Engine status:** Handled. `src/lib/providers/index.ts` refreshes the access token when it has less than 60 seconds left (lines ~85-112). It throws a "Your Google connection has expired. Reconnect Google in Settings" error on `invalid_grant` or a missing refresh token. Refresh tokens are encrypted before storage.
- **Gap:** Google's rules for refresh-token lifetime (for example for apps in testing mode or unverified apps) were not verified. The OAuth scopes `webmasters.readonly` and `analytics.readonly` (`google.ts` lines 7-8) may need Google's sensitive-scope verification for production use. Not verified in this session.

### Problem 5: Service-account access and property permissions
- **How common:** Medium. Common in tutorials and connector setup, where the service account must be added to each property.
- **Fix in projects:** Add the service-account email as a user on the property, or use per-user OAuth.
- **Seo Engine status:** Not applicable to the main path. It uses per-user OAuth (`src/lib/providers/google.ts` scopes, `src/lib/google-access.ts`). Property matching is handled in `src/lib/gsc-property.ts`, which handles `sc-domain:` properties against URL-prefix properties. No evidence was gathered on how often users hit a wrong-property error.

### Problem 6: Quota and rate limits (429 and token quotas)
- **How common:** Medium to high for dashboards that refresh often. The GA4 quota page was not reachable, so I cannot quote current per-property limits.
- **Fix in projects:** Cache responses, batch requests, and back off on 429 with a retry.
- **Seo Engine status:** Partial. `src/lib/providers/google.ts` (lines 27-60) caches Google answers for 5 minutes in `providerCache`, keyed by a hash of the token, URL and body, so one project cannot read another's cache. A grep for `429`, `retry` and `backoff` in `google.ts` found no retry or backoff logic. Rank sync runs 5 keywords at a time (`sync.ts` `mapLimit(keywords, 5, ...)`).
- **Gap:** Check quota numbers against Google's quota page once it is reachable. Add a 429 and `Retry-After` handler in `fetchGoogle`.

### Problem 7: Search Console and GA4 page numbers do not match
- **How common:** Very high. The most frequent question in SEO communities (see KQ1 sources).
- **Fix in projects:** Explain the definitions in the UI (clicks are not sessions; GSC uses the canonical URL; GA4 uses the loaded URL). When joining by page, normalise the host, `www`, scheme, trailing slash and query string, but do not merge distinct canonical pages. Compare by landing page rather than site totals first. Anonymised queries and sampling also explain gaps.
- **Seo Engine status:** Partial. There is no page-level normalisation in the code I reviewed. A grep for `trailing`, `normaliz` and `canonical` under `src/lib` found URL normalisation only in `src/lib/audit/analyze.ts` (crawler dedup key, scheme-agnostic and trailing-slash-agnostic) and `src/lib/gsc-property.ts` (property matching). The Search Console and GA4 page joins do not appear to share this normalisation. Not verified in components or actions.
- **Gap:** Check how referrals and page lists are joined in `src/lib/sync.ts` (`syncReferrals`, `ga4ReferralPages`) against Search Console pages. Add a shared normaliser if they are joined. Add a short definitions note on the page.

### Problem 8: Slow loading on large sites
- **How common:** Medium. Evidence is mostly from the row-limit and API-speed issues above; no dedicated forum evidence found.
- **Fix in projects:** Cache, fetch in parallel with limits, show cached or previous data while loading, and use BigQuery for large volumes.
- **Seo Engine status:** Partial. The Google response cache (5 minutes) and concurrency limits in sync are in place. Live reads on page load use a 30 second timeout (`google.ts` `fetchGoogle`). Loading UI is handled in `src/components/dashboard/filter-pending.tsx`: `FilterPendingArea` swaps everything after the page header for `PageBodySkeleton` while a filter transition is pending, so old numbers do not sit beside the new filter. Recent commits "Keep headers visible while loading" (6131625) and "Show a skeleton while a page filter loads" (972d201) show this was a deliberate decision.
- **Gap:** I did not compare these patterns against competitor dashboards (no fetch of other projects' UIs). The UX patterns question remains open.

### Problem 9: Data changes after it was first shown (partial and fresh days)
- **How common:** Not verified. Inferred from the lag reports above.
- **Fix in projects:** Use only final data for history, or label today's numbers as partial.
- **Seo Engine status:** Unknown. `google.ts` uses `dataState: "all"` for daily queries (lines 101, 205) and `hourly_all` for hourly (line 121). These include fresh data that Google may revise. The sync writes `searchConsoleDaily` upserts, so later syncs can overwrite earlier days, which is the right behaviour for revisions, but this should be checked.
- **Gap:** Google's `dataState` semantics were not verified (docs unreachable).

### Problem 10: Merchant Center report and product eligibility errors
- **How common:** Not researched. This is a gap in the research.
- **Seo Engine status:** The code handles product status values (`REJECTED`, `EXPIRED`, `PENDING` and others, `google.ts` line 966) and merchant write checks. Shipping, promotions and product validation exist (`merchant-shipping.ts`, `merchant-products.ts`, `merchant-promotions.ts`), with URL validation.
- **Gap:** No forum or issue-tracker evidence gathered for Merchant Center problems or the Merchant API migration.

---

## Key question 3: UX patterns for loading, comparison and granularity

### Takeaway
Only Seo Engine's own patterns were verified. The pattern that matters is "never show old numbers next to new filter values", which Seo Engine does through a full-body skeleton. Competitor patterns were not researched.

### Cited Findings
- Seo Engine's skeleton logic: `src/components/dashboard/filter-pending.tsx` (shared transition, `PageBodySkeleton` of 4 KPI tiles, chart and table placeholders).
- Recent commits show the granularity work: "Make Hourly usable from any range on Performance" (cc43832), "Remove the Hourly/Daily dropdown; keep headers visible while loading" (6131625), "Bring back the Granularity dropdown with Weekly and Monthly" (10dcd42).
- The hourly view in `search-console-live.ts` (lines 73-78) fetches a week more data for week-over-week comparison, which is a sound approach.

### Inferences
- Replacing the whole body with a skeleton is safe but hides context. Keeping the previous data visible with a dimmed overlay, as many dashboards do, lets users compare without losing their place. This is an inference, not a verified competitor pattern.

### Gaps
- No competitor dashboard UIs were inspected. Could not confirm the patterns used by open-source SEO dashboards.

---

## Key question 4: Keeping page-level SEO data consistent across Search Console and GA4

### Takeaway
The sources agree on the cause (canonical URLs, loaded URLs, anonymised queries, units). I did not find a project-level fix, and Seo Engine does not normalise page joins in the code I reviewed.

### Cited Findings
- GSC groups by canonical URL, GA4 records the loaded URL, and sessions and clicks differ (SEJ and vendor sources above; search summaries only).
- The "normalise host, trailing slash and query, but do not merge canonicals" approach comes from a vendor blog (search summary only).
- A Google Search Central community thread reports clicks and impressions differing by about 60% between the dashboard and API exports when page and query are included. Cause unexplained (search summary only).

### Inferences
- A shared normaliser for page keys is the cheapest fix for the join problem, and the audit module already has one to start from (`src/lib/audit/analyze.ts` line 25).

### Gaps
- No open-source project's normalisation code was inspected.

---

## Summary table

| # | Problem | Frequency (evidence) | Seo Engine status | Action |
|---|---|---|---|---|
| 1 | Last 2-3 days late or missing | High (trade press, Fivetran docs) | Partial: `lastDataAt` in hourly only | Add daily "data through" notice |
| 2 | Row caps truncate (25k/req, 50k/day) | High (open issues, KB) | Not handled: no `startRow` loop | Paginate or flag truncation |
| 3 | Hourly window short | Medium | Handled by comment only; comments conflict | Verify window, clamp/notify |
| 4 | Token expiry and revocation | High | Handled (refresh plus reconnect) | Verify Google refresh-token rules |
| 5 | Service account / property access | Medium | N/A (per-user OAuth); property match in `gsc-property.ts` | None needed |
| 6 | Quota and 429 | Medium to high | Partial: 5-min cache, no 429 backoff | Add retry on 429 |
| 7 | GSC vs GA4 mismatch | Very high | Partial: no page-key normalisation | Shared normaliser plus definitions note |
| 8 | Slow large sites | Medium | Partial: cache, concurrency, skeleton | Competitor comparison not done |
| 9 | Data revised after display | Not verified | Unknown: `dataState: "all"` | Check semantics |
| 10 | Merchant Center eligibility | Not researched | Validation and status handling exist | Research gap |

## Priority gaps for follow-up
1. Verify the GSC hourly window and `dataState` semantics on developers.google.com (blocked from this session).
2. Verify GA4 Data API quota numbers (blocked).
3. Fix the row-limit truncation in `providers/google.ts`. This is the highest-impact finding because it is silent.
4. Check GSC and GA4 page joins in `sync.ts` for normalisation.
5. Merchant Center forum research.
