# Open-source and self-hosted dashboards that combine Search Console and GA4

Research date: 2026-11-21. Scope: projects that put Google Search Console (GSC) and GA4 in one dashboard, compared with Seo Engine. Activity figures come from the GitHub search API (`pushed_at`, stars, licence). `pushed_at` is the last push, not the last commit date; the exact last-commit date was not verified for any project. Feature details come from WebFetch summaries of each project page, not from the source code, so anything marked "not documented" may still exist in the code.

## Key Question 1: Which projects combine GSC and GA4 in one place, and how do they join them?

### Takeaway
Only a few open-source, self-hosted projects in 2026 put GSC and GA4 in one dashboard. SailDesk is the only one whose join method is documented (it matches GA4 properties to Search Console sites by name). Most open-source options do not join the two sources by page URL; they show them side by side per site. Seo Engine is the only project in this set that joins them on one timeline with tracked rank data.

### Comparison table

Stars and last push come from the GitHub API (2026-11-21). "n/d" means not documented on the project page.

| Project | Stars / last push | Licence | Google sources | Join method | Stored or live | Hourly data | Google auth | Date filter | Country filter | Granularity | Loading / error states | Setup (from README) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Seo Engine** (this repo) | local project | see repo | GSC + GA4 | Daily rows stored in MySQL; GA4 organic sessions on one timeline with tracked ranks (join key not stated in README; by date is inferred) | Daily rows stored; live GSC reads for hourly, comparison and older ranges | Live read from GSC (per task brief) | Per-client Google service account key, or sign-in | Yes | n/d in README | Daily | n/d in README | `npm install`, `.env`, `prisma migrate deploy`, seed, `npm run dev`; needs Node 20.19+ and MySQL 8+ |
| **OpenGSC** (fenjo26/OpenGSC) | 61 stars; pushed 2026-11-18; MIT | MIT | GSC + GA4 (a GA4 property is linked to any site), plus Bing and Yandex webmaster APIs and Clarity | n/d | Stores locally in SQLite; Bing and Yandex read live with server-side cache | n/d | Google OAuth; the owner signs in with email and password | Presets 7d, 28d, 3m, 6m, 12m, 16m; previous period, year over year, or custom | n/d | n/d | n/d | `curl ... install.sh \| sudo bash` on a VPS with a domain (Google OAuth does not work on a bare IP); `npm run create-owner` |
| **Ninja Analytics** (looneyhills1-png/ninja-analytics) | 0 stars; pushed 2026-11-16; MIT | MIT | GA4 (Data API) + GSC (Search Console API) + Bing Webmaster | Separate tables per source (`analytics_daily`, `search_daily`); join not described | Stores history in Postgres; syncs from the APIs on schedule and on demand | Not used: data is daily; hourly is only uptime checks | OAuth (client ID, secret, refresh token), read-only scopes; not a service account | n/d | n/d | Daily only | n/d | 8 steps: Supabase project and 11 migrations, Google APIs and OAuth consent, Bing key, Edge Function secrets, `supabase` CLI deploy, admin allowlist with TOTP MFA, Cloudflare Pages frontend. The README badge points to another repo, so the docs may be copied |
| **SailDesk** (nykee/SailDesk) | 0 stars; pushed 2026-11-08; MIT | MIT | GSC + GA4 (every GSC property is paired with its GA4 property) + Bing + Umami | Pairs by GA4 display name against the site domain, with a `hostName` probe as fallback; at most one site per GA4 property | Reads GSC and GA4 live on each request; no database; Bing served from a KV cache (7-day TTL) | n/d | OAuth desktop client, refresh token stored as a Cloudflare secret; dashboard password | Last 7, 28 or 90 days, or custom; compared to the equal preceding period | Country is one of five GA4 breakdowns; no filter control described | n/d | n/d | Enable APIs, create OAuth client, `pnpm gsc:authorize`, set Cloudflare secrets, `pnpm run deploy` (Cloudflare Workers) |
| **QueryRank** (AhmadFaraz-crypto/QueryRank) | 0 stars; pushed 2026-11-02; MIT | MIT | GSC + GA4 over OAuth; CSV import as an alternative | n/d | Described as live streaming to charts; dashboards persist to Postgres; metric history storage not stated | n/d | OAuth you register yourself; refresh tokens encrypted at rest | Last 7, 14, 28, 30, 90 days, 12 months, or custom; period-over-period deltas; default 28 days | n/d | n/d | "Data not loaded" card state; unconnected sources fall back to sample data | Docker Compose for Postgres, copy `.env`, set `APP_SECRET` and `ALLOWED_EMAIL`, `pnpm dev:all` |
| **OpenFindability** (eliazv/OpenFindability) | 4 stars; pushed 2026-11-13; MIT | MIT | GSC (with index audit); GA4 not listed (uses Umami for site analytics) | No GA4 join | SQLite-backed; storage detail from the repo description only | n/d | n/d (only the description was read) | n/d | n/d | n/d | n/d | Local dashboard with a Claude Code MCP server; search snippet only, not verified |
| **Insightistic** (Wordpressistic/insightistic) | 0 stars; pushed 2026-11-19; GPL-2.0 | GPL-2.0 | GA4 + GSC + PageSpeed + Cloudflare + WooCommerce, in a WordPress plugin | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | WordPress plugin; search snippet only, not verified |
| **stats-dashboard** (DavidVeksler/stats-dashboard) | 0 stars; pushed 2026-11-20; MIT | MIT | GSC keywords + Cloudflare Web Analytics (not GA4) + Discourse | Not a GSC and GA4 join | Daily D1 snapshots (Cloudflare Worker); snapshot storage | n/d | n/d | n/d | n/d | Daily | n/d | Cloudflare Worker; search snippet only |
| **Looker Studio templates** (Windsor.ai, Supermetrics, Piped Out, CRO:NYX, #SEOSLY) | n/a (not repos) | Not open source; free to copy | GSC + GA4 connectors | Windsor.ai blends on date and landing page; warns that GSC gives full URLs and GA4 gives page paths, so a path field must be created on one side | Live through Google connectors; no stored history | n/d | Google connectors (owner's account) | Looker date controls | Looker controls | Looker controls | Copy the template, then connect your own GSC and GA4 properties |
| **Metabase** (+ external sync) | Metabase has no built-in GSC connector | Not verified (open source per general knowledge, licence not checked) | None built in | Requires a sync into a warehouse first (hosted tools such as Kondado, or a custom script) | Stored in the warehouse once synced | n/d | n/a | Metabase filters | Metabase filters | Metabase filters | n/d | Sync step, then point Metabase at the database |
| **Grafana** | No free GSC plugin was found | Not verified | None found | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | Not verified |

Note on hosted tools (short, not compared): Windsor.ai, Supermetrics, Improvado, Databox and Coupler offer paid GSC and GA4 connectors for Looker Studio, Metabase or Grafana.

### Cited Findings
- SailDesk "reads every Search Console property your Google account can access, pairs each one with its Google Analytics 4 property"; GA4 is matched by display name against the domain — [SailDesk](https://github.com/nykee/SailDesk)
- SailDesk reads GSC and GA4 "live from Google APIs on each request" and says it has "no database, no server to maintain" — [SailDesk](https://github.com/nykee/SailDesk)
- OpenGSC lets you "Link a GA4 property to any site" to show sessions, engagement, key events and revenue — [OpenGSC](https://github.com/fenjo26/OpenGSC)
- OpenGSC stores data in "your own SQLite database" and pulls Bing and Yandex live with server-side caching — [OpenGSC](https://github.com/fenjo26/OpenGSC)
- Ninja Analytics stores history in Postgres tables `analytics_daily` (GA4) and `search_daily` (GSC), and uses "daily aggregate data" — [Ninja Analytics](https://github.com/looneyhills1-png/ninja-analytics)
- QueryRank says both sources "connect over OAuth and stream live data straight into the dashboard charts" — [QueryRank](https://github.com/AhmadFaraz-crypto/QueryRank)
- Windsor.ai's free Looker Studio SEO template blends GSC and GA4 on date and landing page; Search Console reports full URLs and GA4 reports page paths, so one side needs a path field first — [Windsor.ai](https://windsor.ai/data-studio-seo-reporting-template/) (via WebSearch summary)
- Metabase has no built-in Search Console connector; the usual route is a sync into a database or warehouse first — [Metabase SEO analytics](https://www.metabase.com/analytics/seo-analytics) (via WebSearch summary)
- Star and push data: OpenGSC 61 stars, pushed 2026-11-18; OpenFindability 4 stars; the other repos list 0 stars (GitHub API, 2026-11-21)

### Inferences
- Among the open-source projects, only SailDesk documents a join method, and it joins by domain name, not by page URL. Seo Engine's timeline view is closer to "joined by date" than any other project here, but that is inferred from the README wording.
- Most of the GitHub projects are new (0 stars). Commit counts from the project pages: SailDesk 6, QueryRank 8, Ninja Analytics 106, OpenGSC 1,036. Only OpenGSC has a long commit history; the rest are early-stage and their stability is unknown.

### Gaps
- Join key for Ninja Analytics, OpenGSC and QueryRank (site-level or page-level) is not documented on the pages read. Source code not read.
- Insightistic, OpenFindability and stats-dashboard were judged from search snippets and repo descriptions only, not from their READMEs. Their feature claims are unverified.
- The gh README fetch returned empty content for every candidate, so the WebFetch summaries are the only source for their features.

## Key Question 2: How do they handle Search Console's data limits (about 16 months, hourly data kept briefly, daily row limit)?

### Takeaway
None of the open-source projects read here documents handling of GSC's hourly data, and none documents handling of the daily row limit. Projects that store data (Ninja Analytics, OpenGSC, QueryRank) keep history in their own database. Projects that read live (SailDesk) depend on GSC's own retention, so they cannot show data older than GSC keeps.

### Cited Findings
- OpenGSC has date presets up to 16 months (16m), which matches GSC's retention window — [OpenGSC](https://github.com/fenjo26/OpenGSC)
- Ninja Analytics says analytics data is daily and that hourly activity is limited to uptime checks — [Ninja Analytics](https://github.com/looneyhills1-png/ninja-analytics)
- SailDesk offers 7, 28 or 90 day ranges, all within GSC's retention limit — [SailDesk](https://github.com/nykee/SailDesk)
- Seo Engine stores daily rows and reads live from GSC for hourly, comparison and older ranges (task brief and README) — [Seo Engine README](/home/user/Seo-Analytics/README.md)

### Inferences
- Live-only projects (SailDesk) cannot keep history past GSC's retention. Stored-history projects (Ninja, OpenGSC, Seo Engine) can, but only if they sync before the window closes.

### Gaps
- Whether any project handles the GSC daily row limit (per-day row cap) is not documented on the pages read.
- Hourly handling in OpenGSC, QueryRank and SailDesk is not documented.

## Key Question 3: Which show weekly or monthly granularity, and how?

### Takeaway
No project read shows an explicit weekly or monthly granularity selector. OpenGSC and QueryRank offer longer date ranges (3, 6, 12 or 16 months) but not a grouping setting. Looker Studio templates may offer grouping controls, but these were not verified.

### Cited Findings
- OpenGSC presets: 7d, 28d, 3m, 6m, 12m, 16m — [OpenGSC](https://github.com/fenjo26/OpenGSC)
- QueryRank ranges: 7, 14, 28, 30, 90 days, 12 months, or custom — [QueryRank](https://github.com/AhmadFaraz-crypto/QueryRank)
- Ninja Analytics: "The only granularity described is daily" — [Ninja Analytics](https://github.com/looneyhills1-png/ninja-analytics)

### Inferences
- Weekly and monthly views are probably built as groupings on top of daily rows, but no project here shows this, so it is unverified.

### Gaps
- Weekly or monthly grouping was not found in any project read. Looker Studio and Metabase can group by week or month, but no SEO template was checked for it.

## Key Question 4: What setup steps does each require, and how long do they take?

### Takeaway
Setup ranges from a single install script on a VPS (OpenGSC) to a multi-service stack (Ninja Analytics: Supabase, Cloudflare Pages, Google Cloud, Bing). Time estimates were not verified; the figures below are step counts from each README.

### Cited Findings
- OpenGSC: one install script on a VPS with a domain, then `npm run create-owner`; Google OAuth fails on a bare IP — [OpenGSC](https://github.com/fenjo26/OpenGSC)
- Ninja Analytics: 8 steps across Supabase (11 migrations), Google Cloud OAuth, a Bing key, Edge Function secrets, a Supabase CLI deploy, MFA and a Cloudflare Pages frontend — [Ninja Analytics](https://github.com/looneyhills1-png/ninja-analytics)
- SailDesk: 7 steps across Google Cloud, a local OAuth flow, Cloudflare secrets and a Workers deploy; Bing and Umami are optional — [SailDesk](https://github.com/nykee/SailDesk)
- QueryRank: Docker Compose for Postgres, `.env`, optional Google OAuth app, then `pnpm dev:all` — [QueryRank](https://github.com/AhmadFaraz-crypto/QueryRank)
- Seo Engine: `npm install`, `.env`, `prisma migrate deploy`, seed, `npm run dev`; needs Node 20.19+ and MySQL 8+ (README) — [Seo Engine README](/home/user/Seo-Analytics/README.md)

### Inferences
- Seo Engine and QueryRank are closest to a local single-process setup. OpenGSC and Ninja need a server or a multi-service cloud setup. SailDesk needs a Cloudflare account but no database.

### Gaps
- Time to set up was not measured or documented for any project.
- Google Cloud project creation and OAuth consent screen review can take time outside the project's control; not verified here.

## Notes not verified
- No Metabase, Grafana or Looker Studio project with a GSC plus GA4 connector and an open licence was found. The Looker Studio results were commercial vendor templates, not repos.
- Star counts and push dates were read from the GitHub search API. Commit dates were not verified.
- The nazli1golpayegani-web/seo-intelligence-dashboard repo (GSC + GA4, 0 stars, pushed 2026-11-11) has no licence and was not read.
