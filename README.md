# Seo Engine

An open source, self-hosted SEO dashboard. Track Google rankings over time, research keywords, watch backlinks, get an overview of any domain, and see Search Console and GA4 next to your ranking history, so you can tell what is working.

- **Rank tracking:** daily Google positions (top 100) per keyword, with sparklines, filters, a per-keyword history chart and a change log
- **Search performance:** Search Console clicks, impressions, CTR and queries plus GA4 organic sessions on one timeline with your tracked ranks. Striking-distance queries are flagged and can be tracked in one click
- **Keyword research:** ideas with volume, difficulty, CPC, competition and intent. Filter, then track the ones you want
- **Domain overview:** organic keywords and estimated traffic over time, position distribution, top pages, plus an ad-hoc lookup for competitors
- **Backlinks:** referring domains over time, top anchors, and a filterable list of the strongest links (new, lost, dofollow)
- **Demo mode:** six months of generated sample data, plus a one-click "Explore the demo" sign-in
- **Sign-in:** email and password, and optionally Google
- **REST API:** API keys for scripts and agents, with an OpenAPI spec at `/api/v1/openapi.json`

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Recharts, Prisma 7 + MySQL, Better Auth, Zod.

## Quick start

Requirements: Node.js 20.19+ and MySQL 8+ (or MariaDB 10.6+).

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npx prisma migrate dev --name init
npm run db:seed             # creates the demo account + demo project
npm run dev
```

Open http://localhost:3000 and click **Explore the demo**, or create an account.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `mysql://user:pass@host:3306/bisibility`. Create the database first. |
| `BETTER_AUTH_URL` | yes | The public URL of the app. |
| `BETTER_AUTH_SECRET` | yes | 32+ random characters. |
| `APP_ENCRYPTION_KEY` | yes | 64 hex characters. Encrypts the DataForSEO passwords users save. |
| `DEMO_MODE`, `DEMO_EMAIL`, `DEMO_PASSWORD` | no | Demo sign-in button and the seeded account. |
| `ALLOW_SIGNUP` | no | `false` closes registration. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google sign-in, Search Console and GA4. |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | no | Server-wide fallback when a user hasn't connected their own account. |
| `BING_WEBMASTER_API_KEY` | no | Server-wide Bing Webmaster Tools key, the free backlink source for verified sites. |
| `SERPER_API_KEY`, `SERPER_RANK_DEPTH` | no | Server-wide Serper key for rank checks, and how deep to check (10–100, default 50). |
| `CRON_SECRET` | no | Protects the scheduled sync endpoint. |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # APP_ENCRYPTION_KEY
```

## Connecting data providers

### Serper (rank checks, free tier)

[Serper.dev](https://serper.dev) gives 2,500 free queries and is the cheapest way to track rankings. In **Providers & API**, under **Serper**, paste your API key and pick a check depth. When Serper is connected, rank checks use it. Keyword ideas, domain overview and backlinks still need DataForSEO.

How credits are spent: Google now shows only 10 results per page, so checking the top 100 can take 10 requests. Seo Engine fetches pages in order and **stops at the page where your site appears**. A keyword at #4 costs 1 credit and a keyword at #23 costs 3. A keyword you don't rank for costs the full depth: 5 credits at the default top 50.

Limits: Serper returns desktop results only, and it needs a country from the project's location list. Projects tracking mobile rankings, or a location outside that list, should use DataForSEO.

Server-wide fallback: `SERPER_API_KEY` and `SERPER_RANK_DEPTH` in `.env`.

### DataForSEO (keyword ideas, domain overview, backlinks; rankings without Serper)

1. Create an account at [dataforseo.com](https://dataforseo.com) and add credit (pay as you go).
2. Copy the **API login and API password** from [API access](https://app.dataforseo.com/api-access). These are not your account password.
3. In the app go to **Providers & API**, then **DataForSEO**, and paste them. They're checked with one cheap call and stored encrypted.

Endpoints used:

| Feature | Endpoint |
|---|---|
| Rank check | `POST /v3/serp/google/organic/live/advanced` (depth 100) |
| Keyword ideas | `POST /v3/dataforseo_labs/google/keyword_ideas/live` |
| Domain overview | `POST /v3/dataforseo_labs/google/domain_rank_overview/live` |
| Top pages | `POST /v3/dataforseo_labs/google/relevant_pages/live` |
| Backlink summary | `POST /v3/backlinks/summary/live` |
| Backlinks list | `POST /v3/backlinks/backlinks/live` |

The Backlinks API is a separate DataForSEO subscription. Without it the domain and backlinks sync reports an error, and rankings and keyword research keep working.

Keyword-idea and competitor lookups are cached for 24 hours in the `ProviderCache` table, so repeat searches cost nothing.

### Bing Webmaster Tools (backlinks for your own sites, free)

1. Add and verify your site at [Bing Webmaster Tools](https://www.bing.com/webmasters). You can import it from Google Search Console.
2. In Bing, go to **Settings → API access → API key** and copy the key.
3. In Seo Engine, go to **Providers & API → Bing Webmaster Tools** and paste it. It's checked by listing your verified sites.
4. Optionally pick the Bing site in **Project settings**. Otherwise it's matched to the project's domain automatically.

Bing reports the linking page and anchor text only. Domain rank, dofollow/nofollow and first-seen dates show as "—" or "Unknown". Each sync reads up to 500 links across your 25 most-linked pages.

### Using DataForSEO and Bing together

Each project chooses its backlink sources in **Project settings → Backlink sources**. Both are on by default. Every refresh fetches from each source that's switched on and connected, and stores them **separately**, each with its own history. One source failing (for example, no DataForSEO Backlinks subscription) shows a warning and doesn't stop the other.

On the **Backlinks** page, the **DataForSEO | Bing** switch changes the view instantly. The summary, chart, table, CSV and PDF report all follow it. Turn DataForSEO off for a project to stop spending its credits there.

API: `GET /api/v1/projects/{id}/backlinks?source=dataforseo|bing`. Leave `source` out to get both, with each row tagged by source.

Endpoints: `GetUserSites`, `GetLinkCounts`, `GetUrlLinks` on `https://ssl.bing.com/webmaster/api.svc/json/`.

### Backlink reports

- **CSV:** on the Backlinks page, **Export CSV** downloads the rows matching your current filters.
- **PDF:** **PDF report** opens a print-ready report at `/report/{projectId}/backlinks`, with summary, referring-domain history, top anchors, top referring domains and every link. Click **Print / Save as PDF**. It always prints in light colors.

### Google (sign-in, Search Console, GA4)

1. In [Google Cloud console](https://console.cloud.google.com/), create a project and enable the **Google Search Console API**, **Google Analytics Data API** and **Google Analytics Admin API**.
2. Configure the OAuth consent screen. While the app is in "Testing", add your own Google account as a test user.
3. Create an **OAuth client ID** (Web application) with this redirect URI: `{BETTER_AUTH_URL}/api/auth/callback/google`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart the server.
5. In **Providers & API**, click **Connect Google**. This asks for read-only `webmasters.readonly` and `analytics.readonly` access with offline consent, so the daily sync can refresh the token.
6. In each project's **Project settings**, pick the Search Console property and the GA4 property.

GA4 is filtered to `sessionDefaultChannelGroup = Organic Search`, and conversions use GA4's `keyEvents` metric.

## Scheduled sync

Rank checks and data pulls run when you click **Refresh** or **Check now**, and on a schedule through:

```
POST /api/cron/sync        Authorization: Bearer $CRON_SECRET
```

`npm run sync` calls it for you, using `BETTER_AUTH_URL` and `CRON_SECRET` from `.env`. Run it once a day.

**Linux (crontab):**

```
0 6 * * * cd /opt/bisibility && npm run sync >> /var/log/bisibility-sync.log 2>&1
```

**Windows (Task Scheduler):** create a daily task that runs `cmd /c "cd /d D:\path\to\bisibility && npm run sync"`.

## Self-hosting in production

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # listens on PORT (default 3000)
```

Put it behind a reverse proxy (Caddy, nginx) with HTTPS, set `BETTER_AUTH_URL` to the public URL, and keep a process manager such as pm2 or systemd running `npm start`.

## API

Create a key in **Providers & API**, then **API keys**. Send it as a bearer token:

```bash
curl -H "Authorization: Bearer bsk_..." http://localhost:3000/api/v1/projects
```

| Method | Path | What it returns |
|---|---|---|
| GET | `/api/v1/projects` | Your projects |
| GET | `/api/v1/projects/{id}/report?days=28` | Totals, daily GSC + GA4 + ranking series, top movers |
| GET | `/api/v1/projects/{id}/rankings?days=90&keyword=&tag=` | Ranking history per keyword |
| GET | `/api/v1/projects/{id}/keywords` | Tracked keywords |
| POST | `/api/v1/projects/{id}/keywords` | Track keywords: `{ "keywords": [...], "tags": [...] }` |
| GET | `/api/v1/projects/{id}/backlinks?source=dataforseo\|bing` | Stored backlinks, per source or all |
| GET | `/api/v1/projects/{id}/domain?days=180` | Domain snapshots and top pages |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1 spec (no auth needed) |

Keys are stored only as SHA-256 hashes, can be revoked, and only reach projects owned by the key's user.

## How the numbers are calculated

- **Visibility**: for each tracked keyword, the expected CTR at its current position times its search volume, divided by the same sum if every keyword ranked #1. 100% means #1 everywhere.
- **Average position** counts only keywords that rank in the top 100. Unranked keywords are left out, not counted as 100.
- **Change** compares the first and last check in the selected range. Entering or leaving the top 100 counts from or to 101.

## Project layout

```
prisma/schema.prisma        data model (Better Auth tables + SEO data)
prisma/seed.ts              demo account + demo project
src/lib/providers/          DataForSEO, Google (GSC/GA4), provider selection + cache
src/lib/demo/               deterministic demo data
src/lib/sync.ts             rankings / domain / google sync
src/lib/queries.ts          owner-scoped reads and report building
src/lib/actions/            server actions (zod-validated)
src/app/(app)/              dashboard pages
src/app/api/v1/             public REST API
src/app/api/cron/sync/      scheduled sync endpoint
```

## License

MIT
#   S e o - A n a l y t i c s  
 