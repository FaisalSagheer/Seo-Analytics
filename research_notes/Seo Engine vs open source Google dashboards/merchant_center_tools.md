# How products manage Google Merchant Center from inside their own app

Research date: 2026-11-21. Scope: commercial feed managers, platform channel apps, and open-source tools/SDKs, compared with Seo Engine's Merchant Center section.

## Source access and verification status

- **developers.google.com: not reachable from this session.** Direct fetches failed with `getaddrinfo ENOTFOUND developers.google.com`. Google claims below come from (a) the official Merchant API discovery documents (`https://merchantapi.googleapis.com/$discovery/rest?version=<api>_v1`, revision 20261118), which were fetched and read, and (b) WebSearch result summaries that point to developers.google.com pages whose text I could not open. Those summary-only claims are labelled "search summary, page not opened".
- **Commercial vendor sites: not reachable directly** (datafeedwatch.com, feedonomics.com, channable.com, godatafeed.com, apps.shopify.com, help.shopify.com, woocommerce.com all failed to resolve or connect). Vendor claims below come from WebSearch summaries restricted to each vendor's domain. Those are secondhand and not verified against the live pages. Several vendor pages are months to a year old, and some summaries say they use legacy UI names.
- **GitHub:** repository search via the GitHub API worked. Raw README download worked for `kiwoongeom/gmc-mcp`. The GitHub API returned "not enabled for this session" for `google/rubik` and the other repos, so their README/source could not be read. For `google/rubik` the README was fetched from raw.githubusercontent.com.
- **WooCommerce Google channel app: no source reached.** Gap.
- **Google's own Merchant API samples on GitHub: not found** in the tag searches below. Gap.

---

## Key Question 1: How do the leading tools edit products that come from a feed without changing the feed? Is a supplemental data source the standard approach?

### Takeaway
Yes. Every tool that reads or enriches product data without touching the primary feed uses a supplemental data source (called "supplemental feed" in older docs), linked to a primary data source by product ID. Seo Engine does the same thing: it creates one API-owned supplemental source and links it first in the primary source's default rule. Vendors also rely on rule engines, either inside Merchant Center (feed rules, now called attribute rules) or inside their own platforms.

### Cited Findings
- The Merchant API discovery document describes a supplemental source as "the supplemental data source for local and online products. After creation, you should make sure to link the supplemental product data source into one or more primary product data sources." — [Merchant API datasources_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=datasources_v1) (fetched)
- The same discovery document shows `dataSources.create`, `dataSources.patch`, `dataSources.fetch` and `dataSources.delete`, so a supplemental source can be created and linked through the API. — [datasources_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=datasources_v1) (fetched)
- DataFeedWatch's guide says a supplemental feed "can only be used in addition to the Primary feed", needs a product ID column that matches the primary feed, and is linked automatically by a rule once added. Its listed uses are sale prices, custom labels, overriding attributes, adding missing GTINs, fixing disapprovals, excluding products and local inventory. — [DataFeedWatch: supplemental feeds](https://www.datafeedwatch.com/blog/supplemental-feeds-google-merchant-center) (WebSearch summary; page not opened)
- A WebSearch summary of Feedonomics material says supplemental sources "cannot add or remove products" and join to the primary source on ID, so IDs must match "including case and prefixes". — [Feedonomics: supplemental feed vs. editing in GMC](https://feedonomics.com/blog/using-a-supplemental-feed-vs-editing-product-details-in-google-merchant-center/) (search summary; page not opened)
- Feedonomics also says that editing a product directly in Merchant Center overrides past and future values from primary and supplemental feeds, and that the supplemental feed overrides the primary feed for the attributes it contains. — same URL (search summary)
- Feedonomics and DataFeedWatch both say a supplemental source must be a supplemental type, not a primary source, and that the feed label and language should match the primary source. — [Feedonomics: Google Shopping feeds](https://feedonomics.com/blog/google-shopping-feeds/) (search summary)
- Channable's guidance, from its blog and help centre, is to fill gaps before data goes out using its own mapping and rules steps. It recommends against price-changing rules, because Google requires the feed price to match the website. — [Channable: 10 common Google Shopping errors](https://www.channable.com/blog/10-common-errors-channable-users-connecting-google-shopping) (search summary)
- GoDataFeed's approach is rules on its own Rules tab, plus Conversational attributes mapped or set by rule. Its help says turning these on "does not change the approval status of products you already submit". — [GoDataFeed: create a rule to map product details in GMC](https://help.godatafeed.com/hc/en-us/articles/41852381775131-Feed-Google-How-to-create-a-rule-to-map-your-product-details-in-GMC) (search summary)
- Seo Engine's implementation (read from code): `ensureSource` creates an API supplemental source named after the app's edits source. `linkFirst` puts that source first in the primary source's `defaultRule.takeFromDataSources` and keeps the existing rules after it. Attribute writes go into that supplemental source with an update mask. The product is not touched in the feed. — `src/lib/actions/merchant.ts` lines 408-466
- Seo Engine's delete path calls `productInputs` delete against the primary source, not the supplemental source. — `src/lib/actions/merchant.ts` lines 559-562

### Inferences
- The supplemental source is the standard, documented approach. Seo Engine's approach matches it. The main design choice is whether to link the source first (as Seo Engine does) or after a rule that already transforms the attribute. Feedonomics warns about conflicts between overrides and attribute rules, so the order matters.
- Seo Engine's app-owned edits source is the same pattern the commercial tools use for "overrides". It is not something they do differently.

### Gaps
- I could not confirm the precedence between a supplemental source and a Merchant Center attribute rule from a Google page. The discovery document does not state it. The Feedonomics note about conflicts is a vendor warning, not Google documentation.
- I could not read a vendor page that describes its own UI for editing attributes, so I cannot say whether any vendor offers in-app product editing that writes to a supplemental source.

---

## Key Question 2: Which Merchant Center areas do commercial tools leave out, and which do they cover that Seo Engine does not?

### Takeaway
The commercial feed managers focus on the product feed and its rules: product data, feeds, custom labels, sync errors and disapproval fixes. From the sources I could read, they do not show shipping and returns settings, promotions management, or Shopping performance reports in the way Seo Engine does. Seo Engine covers those areas. The areas I could not verify are reviews and conversions for the vendors.

### Comparison table

Feature coverage is from vendor summaries or the GitHub README. "Unverified" means I could not confirm the item from a source I could read.

| Option | Type | Products | Feeds / data sources | Shipping & returns | Promotions | Reviews | Shopping performance | Writes to MC or reads only | How it edits feed products | Setup and authorisation | Merchant API migration statements |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Seo Engine** (this app) | In-app section | Yes: list, edit attributes, delete product inputs | Yes: create, fetch now, toggle fetch, delete, create/manage feeds | Yes: shipping and returns (validation in `src/lib/merchant-shipping.ts`; write path not inspected here) | Yes: list, insert promotions | Yes: `productReviews` page and API kind | Yes: `reports:search` via Merchant API | Writes, gated by a `merchant.manage` permission. Read-only roles get reads only | Supplemental source "edits" linked first in primary rule | Google OAuth connection in Settings → Google & API; Merchant API enabled in the Google Cloud project; needs Merchant Center account chosen in project settings | Uses Merchant API v1; Product Studio uses `productstudio_v1alpha` |
| **DataFeedWatch** | Commercial feed manager | Yes (feed-level) | Yes: feed rules, supplemental feeds | Unverified | Unverified (supplemental feeds used for sale prices) | Unverified | Unverified | Unverified (feed-based per the guide; API write not confirmed) | Supplemental feed joined by ID, and rules | Unverified | Unverified; search summary says Merchant Center now calls them "attribute rules" and "supplemental data sources" and that both need the Advanced data source management add-on. Vendor claim, not confirmed. |
| **Feedonomics** | Commercial feed manager | Yes (enrichment and rules) | Yes: supplemental sources, attribute rules | Unverified | Unverified | Unverified | Unverified | Unverified | Supplemental source overrides; warns that GMC edits override feed values | Unverified | Same add-on statement as DataFeedWatch (vendor summary) |
| **Channable** | Commercial feed manager with an API connection and feed connection | Yes (rules, Quality step) | Yes: feed and API connections; supplemental feeds | Unverified | Unverified | Unverified | Unverified. A help article covers "Insights" data mismatches against Google Ads | Feed and API connections; API errors show in Channable, feed errors only in GMC (vendor claim) | Rules and mapping in its own platform; supplemental feed linkage troubleshooting | Unverified | Vendor claims a Shopify product ID change in the Merchant API migration can lose item history; not confirmed |
| **GoDataFeed** | Commercial feed manager | Yes (rules per feed) | Yes: feed rules, conversational attributes | Unverified | Unverified | Unverified | Unverified | Unverified (feed-based docs) | Rules tab, custom rules, FEEDDATE | Unverified | Unverified |
| **Shopify Google & YouTube app** | Platform channel app | Yes: syncs products that are available to the online store | Syncs from Shopify; shipping profiles limited to "General" per help summary | Partly: only rates from General shipping profile sync (help summary) | Unverified | Unverified | Unverified | Writes to Merchant Center; one Merchant Center account per store | Shopify is the source; edits happen in Shopify | Connect a Merchant Center account from Google & YouTube channel; initial sync up to 24 hours; review 3-5 business days | Channable says Shopify's move to Merchant API changes product IDs (vendor claim, not confirmed by Shopify or Google) |
| **WooCommerce Google channel** | Platform channel app | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached | Not reached. Gap |
| **gmc-mcp** (`kiwoongeom/gmc-mcp`, MIT, Python) | Open-source MCP server | Yes: read product details and status | Read: data sources | Read: shipping and returns settings | Read: list promotions; "create checkout settings for eligible accounts" | Unverified | Yes: query Shopping reports | Mostly read. Does include some write tools (checkout settings, appeal drafts for merchant review); exact write scope not verified beyond the README | Not stated in README | Own Google credentials; Python server; API calls go directly to Google | README says it is "built on Merchant API v1" with 60 tools. 0.3.2. |
| **Rubik** (`google/rubik`, Apache-2.0 per listing, archived; last push 2025-07-29) | Open-source tool | Writes corrected offers | Reinserts offers into Merchant Center | No | No | No | No | Writes: re-inserts offers with a different image, or clears GTIN | Re-inserts offers, does not use a supplemental source (per README) | Not verified | Not stated. Archived. Pre-dates the 2026 Content API sunset |
| **MoonEyes/google-ecommerce-mcp** (MIT) | Open-source MCP server | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified. Only repo metadata read (listed as covering Merchant Center among GA4, Search Console, Ads) |
| **GajewskiMarcin/FeedForge** (PrestaShop module, license NOASSERTION) | Open-source plugin | Yes: "sync products via the Google Merchant API" (repo description) | Unverified | Unverified | Unverified | Unverified | "monitor" in repo description | Writes (sync) per description | Unverified | Unverified | Uses Merchant API per description. Only description read |
| **google/assortment-quality-for-shopping-ads** (Apache-2.0, archived) | Open-source Google sample | Analysis of product coverage | No | No | No | No | Coverage analysis | Reads | Not applicable | Not verified | Archived. Metadata only |

### Cited Findings
- The discovery documents list these Merchant API resource groups: `products`, `reports` (`reports:search` only), `datasources` (create, get, list, patch, delete, fetch, fileUploads), `promotions` (list, get, insert), `issueresolution`, `accounts` (including `issues.list`, `shippingSettings`, `onlineReturnPolicies`, `programs` with checkout settings, `regions`, `users`, `services`), `reviews_v1` (`productReviews`), and `productstudio_v1alpha`. — [accounts_v1](https://merchantapi.googleapis.com/$discovery/rest?version=accounts_v1), [products_v1](https://merchantapi.googleapis.com/$discovery/rest?version=products_v1), [reports_v1](https://merchantapi.googleapis.com/$discovery/rest?version=reports_v1), [datasources_v1](https://merchantapi.googleapis.com/$discovery/rest?version=datasources_v1), [promotions_v1](https://merchantapi.googleapis.com/$discovery/rest?version=promotions_v1), [issueresolution_v1](https://merchantapi.googleapis.com/$discovery/rest?version=issueresolution_v1), [productstudio_v1alpha](https://merchantapi.googleapis.com/$discovery/rest?version=productstudio_v1alpha) (all fetched and listed)
- gmc-mcp's README lists these workflows: catalog and issue diagnosis, Shopping insights (performance, pricing, category, competitive visibility and best-seller reports), merchant configuration (shipping, returns, data sources, programs, users, quotas), inventory and account connections, promotions and checkout, storefront policy audit, and fix plans with appeal drafts. — [gmc-mcp README](https://github.com/kiwoongeom/gmc-mcp) (raw README fetched)
- Rubik's README says it "can improve reproved offers" by re-inserting offers with different images, and by cleaning the GTIN on offers reproved for GTIN. — [google/rubik README](https://github.com/google/rubik) (raw README fetched)
- Repo tag search returned these open-source results: `google/rubik` (Apache-2.0, archived), `kiwoongeom/gmc-mcp` (MIT, 60 tools), `MoonEyes/google-ecommerce-mcp` (MIT), `HYPD-AI/ads-mcp-plugin` (MIT, Merchant Center analysis), `GajewskiMarcin/FeedForge` (PrestaShop 8/9, Merchant API sync), `google/assortment-quality-for-shopping-ads` (Apache-2.0, archived), `PrestaShopCorp/psxmarketingwithgoogle`. — [GitHub topic:merchant-center](https://api.github.com/search/repositories?q=topic:merchant-center), [GitHub topic:google-merchant-center](https://api.github.com/search/repositories?q=topic:google-merchant-center), [GitHub topic:google-shopping](https://api.github.com/search/repositories?q=topic:google-shopping)
- Seo Engine's notifications page merges account issues (`listAccountIssues`, which calls `accounts.issues.list` per the discovery doc), product health, latest feed file uploads, programs and promotions. — `src/lib/shopping.ts` lines 543-575

### Inferences
- Seo Engine covers more of the Merchant Center surface than the commercial feed managers I could read: shipping and returns, promotions writes, feed fetch control, reviews, and reports. The vendors mainly cover feeds and product rules.
- The gap that matters most is coverage I could not check: vendor shipping, promotions and reviews features. Their marketing pages could show more than their help centres do. I cannot say they lack these features.
- Open-source tools are small and narrow. The strongest open-source overlap is gmc-mcp, which is read-heavy and covers reports, shipping, data sources and promotions. It is a different product type (an MCP server for assistants), not an in-app dashboard.

### Gaps
- Vendor coverage for shipping, promotions, reviews and performance reports could not be verified from vendor pages. Only summaries were available.
- I did not reach any Google page that lists which Merchant Center areas the Merchant API covers. The discovery document lists the resources and methods, which is what I used.

---

## Key Question 3: What does Google's Merchant API documentation say about rate limits, caching and report eligibility errors, and how do tools cope?

### Takeaway
The official quota page could not be opened. A WebSearch summary of it says limits are per quota group, with a per-minute and a daily limit. A per-minute breach returns `quota/request_rate_too_high`, and Google advises client-side throttling and exponential back-off. The discovery document confirms that report search needs `PERFORMANCE_REPORTING` or `ADMIN` access, and that each product's report status is one of several eligibility values. Seo Engine caches responses for 5 minutes and clears the cache after every write.

### Cited Findings
- WebSearch summary of the Merchant API quota page says: each quota group has a per-minute limit with a rolling window that starts at the first call for that method and resource. Limits differ by group. Batching does not reduce quota use, because each request in a batch counts. The per-minute error code is `quota/request_rate_too_high`, and Google advises back-off and "Implement client-side rate limiting (throttling) in your application. Don't rely solely on Google's servers to reject excess traffic." — [Merchant API quotas](https://developers.google.com/merchant/api/guides/quotas-limits/quotas) (search summary; page not opened)
- The same summary says the `quotas.list` method returns the daily limit, minute limit and daily usage for each group. — same URL (search summary)
- The accounts_v1 discovery document says "For the `accounts.list` method, quota and limits usage are charged for each user, and not for the Merchant Center ID or the advanced account ID." Use `accounts.listSubaccounts` for advanced accounts. — [accounts_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=accounts_v1) (fetched)
- The reports_v1 discovery document says `reports.search` "Executing this method requires the Performance and insights (`PERFORMANCE_REPORTING`) or admin (`ADMIN`) access right." — [reports_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=reports_v1) (fetched)
- The reports_v1 schemas define `aggregatedReportingContextStatus` with the values: not specified; "not eligible or is disapproved for all reporting contexts and countries"; "pending in all reporting contexts and countries"; eligible for some; eligible for all. — [reports_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=reports_v1) (fetched)
- The reports_v1 discovery says the search response "might contain fewer rows than specified by `page_size`" and that callers should rely on `next_page_token`. — same URL (fetched)
- The Content API for Shopping sunset: a WebSearch summary of Google's sunset page says the sunset date was 18 August 2026, that a "progressive service degradation process" starts 1 September 2026, and that post-sunset calls return a message to migrate to Merchant API v1. The summary said it found no confirmation of whether the extension form is still open. — [Google sunset page](https://developers.google.com/shopping-content/guides/sunset) (search summary; page not opened). Today is 21 November 2026, so the date has passed.
- Seo Engine caches Google responses for 5 minutes (`CACHE_SECONDS = 5 * 60`) in a `providerCache` table. After any write it deletes every `providerCache` row, not only the current project's rows. — `src/lib/providers/google.ts` lines 27-48; `src/lib/actions/merchant.ts` lines 74-77
- Seo Engine's error mapping (`merchantProblem`) recognises disabled APIs, missing OAuth scopes, and 403/404 errors. It maps the Product Studio allowlist and alpha errors separately. — `src/lib/shopping.ts` lines 62-75; `src/lib/actions/merchant.ts` lines 921-925

### Inferences
- Seo Engine's 5-minute cache is well within Google's stated design. Its cache clear after each write is safe but global, so one project's write also flushes other projects' cached answers. That costs quota after writes, and the cost grows with the number of projects.
- Seo Engine does not parse `quota/request_rate_too_high` or retry with back-off in the code I read. The error path turns any Google error into a message. I did not search the full provider file for a retry loop, so this is a narrower claim: the mapping function does not handle this code.
- Commercial tools that connect over the API (Channable's API connection, per its help summary) surface errors in their own UI immediately. Feed-based connections only show errors in Merchant Center. That is the main difference in how tools cope with eligibility and sync errors.

### Gaps
- I could not open the Google quota page, so I cannot quote the actual per-minute or daily numbers. Mark as unverified.
- I could not confirm which error codes report-eligibility failures return, or whether they use the same quota error format.
- I could not confirm how vendors handle back-off, because no vendor page on rate limits was read.

---

## Key Question 4: How do tools present account issues and notifications?

### Takeaway
Google's Merchant API exposes account issues (`accounts.issues.list`), per-product status (`aggregateProductStatuses`, `productstatuses`) and issue-resolution actions (`issueresolution.renderaccountissues`, `renderproductissues`, `triggeraction`). Seo Engine merges these into one notifications page with links back to the relevant area. The vendors I could read show errors per product in their own UI, and feed errors in Merchant Center. I could not verify any vendor's notification or email system.

### Cited Findings
- The `accounts.issues.list` method "Lists all account issues of a Merchant Center account". For multi-client accounts it returns issues for that account only; sub-accounts need to be listed separately. — [accounts_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=accounts_v1) (fetched)
- The issueresolution_v1 discovery exposes `aggregateProductStatuses.list`, `renderaccountissues`, `renderproductissues` and `triggeraction`. `renderaccountissues` returns "Response containing an issue resolution content and actions for listed account issues." — [issueresolution_v1 discovery](https://merchantapi.googleapis.com/$discovery/rest?version=issueresolution_v1) (fetched)
- The issueresolution_v1 description says issue severity can cause "an account suspension or an item disapproval", and that warnings "can negatively impact the performance of ads". — same URL (fetched)
- Seo Engine's notifications aggregator maps account-issue severities (CRITICAL, ERROR, SUGGESTION, else warning) and product statuses (DISAPPROVED, DEMOTED, else info). It links each notice back to Settings or Products. It also lists the latest uploaded file for each file-based feed. — `src/lib/shopping.ts` lines 543-575
- Channable's help summary says the API connection "will communicate the errors immediately in Channable", while errors from a feed "will only be found in the Google Merchant Center." — [Channable: Shopify app data safeguard / Google Shopping error guide](https://www.channable.com/blog/10-common-errors-channable-users-connecting-google-shopping) (search summary)
- Channable's Quality step is described as catching "empty fields, invalid identifiers, and non-unique IDs" and showing how many products are affected before data reaches Google. — same URL (search summary)
- Shopify's help summary lists product-level sync errors: "Missing image" and "Missing GTIN or MPN", and notes that changing a product in Shopify can cause errors on products that already synced. — [Shopify Google & YouTube sync docs](https://help.shopify.com/en/manual/online-sales-channels/marketplaces/google/getting-setup/syncing-products) (search summary)
- DataFeedWatch recommends the Feed rules tab's test function, noting results may take 10-20 minutes. — [DataFeedWatch supplemental feeds](https://www.datafeedwatch.com/blog/supplemental-feeds-google-merchant-center) (search summary)

### Inferences
- The clearest pattern is: account-level issues go to a notifications or settings view, product-level issues go to the product list with counts, and feed-level errors are shown in the source that owns them. Seo Engine follows this pattern.
- Vendors that run a rule engine (Channable, GoDataFeed) add a pre-send quality step. That is a different kind of notification: it stops bad data before Google sees it.

### Gaps
- I could not verify any vendor's email or push notification system.
- I did not test `issueresolution.triggeraction` or the render calls, so I cannot say what Seo Engine's UI could do with them.
- Seo Engine does not call `issueresolution` in `src/` (grep). It uses `accounts.issues.list` and product statuses only.

---

## Other findings

- **Seo Engine merge risk:** `afterWrite` in `src/lib/actions/merchant.ts` deletes every `providerCache` row across all projects. This is a correctness-safe but quota-costly choice. Noted under Key Question 3.
- **Product Studio is alpha:** `productstudio_v1alpha` is the only alpha surface in the discovery set, and the app already handles its 403/404 allowlist errors. Shopping features that depend on alpha APIs may change without notice.
- **Migration statement:** The official Google migration pages could not be opened. A WebSearch summary said the Content API sunset was 18 August 2026 and that Merchant API v1 is the successor. This is the only sunset information in this note, and it is secondhand.

## Overall gaps

1. developers.google.com was unreachable. Quota numbers, the Google migration guide, the eligibility error list and any Google sample repository are not verified.
2. Vendor sites were unreachable. Vendor claims are from WebSearch summaries of vendor blogs and help centres. Several are a year old or use legacy UI names.
3. WooCommerce's Google channel app was not reached.
4. Most open-source repositories beyond `kiwoongeom/gmc-mcp` and `google/rubik` were available only as metadata (GitHub API), not as source.
5. Vendor coverage for shipping, promotions, reviews and performance reporting could not be verified for any commercial tool.
