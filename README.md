# Seo Engine

An open source, self-hosted SEO dashboard that needs no paid SEO API. Track your Google rankings over time, see Search Console and GA4 next to them, and audit your site for on-page problems. Everything comes from Google's own free APIs or from crawling the site itself.

- **Rank tracking:** daily average position per keyword from Search Console, with sparklines, filters, a per-keyword history chart and a change log. A new keyword gets up to 90 days of history straight away
- **Search performance:** Search Console clicks, impressions, CTR and queries plus GA4 organic sessions on one timeline with your tracked ranks. Striking-distance queries are flagged and can be tracked in one click
- **Referrals:** the sites and pages that sent visitors, read from GA4, with how each changed against the previous period, which sites are new and which have gone quiet. It is a partial view of your backlinks: only links that sent at least one visit appear
- **Site audit:** crawls up to 50 pages of a project's site and reports missing or badly sized titles and descriptions, H1 problems, broken links, noindex pages, duplicates, thin content, slow pages, robots.txt and sitemap issues, with a 0 to 100 health score
- **Per-client Google access:** a client can hand over a Google service account key for their project, so they never have to sign in
- **Demo mode:** six months of generated sample data, plus a one-click "Explore the demo" sign-in
- **Sign-in:** email and password, and optionally Google
- **REST API:** API keys for scripts and agents, with an OpenAPI spec at `/api/v1/openapi.json`

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Recharts, Prisma 7 + MySQL, NextAuth (Auth.js v5), Zod.

## Quick start

Requirements: Node.js 20.19+ and MySQL 8+ (or MariaDB 10.6+).

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npx prisma migrate deploy
npm run db:seed             # demo account + demo project, and the first admin if SEED_ADMIN_EMAIL is set
npm run dev
```

Open http://localhost:3000 and click **Explore the demo**, or create an account.

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | yes | The database connection. Defaults: `localhost`, `3306`, `root`, no password, `seoengine`. Create the database first. |
| `DATABASE_URL` | no | A single connection string, `mysql://user:pass@host:3306/seoengine`, instead of the five `DB_*` values. It wins if set. |
| `SEED_ADMIN_EMAIL`, `SEED_PASSWORD` | no | Used by `npm run db:seed` to create the first admin account (password at least 8 characters). An existing account with that email is made Admin and keeps its password. Remove `SEED_PASSWORD` afterwards. |
| `DB_SSL`, `DB_SSL_CA`, `DB_CONNECTION_LIMIT` | no | For hosted databases that require TLS. `DB_SSL=true` verifies the server certificate; add `DB_SSL_CA` (PEM text) only when it is not a public CA. `prisma migrate` reads the same settings and trusts public CAs; for a private CA also set `SSL_CERT_FILE` to the CA file for that command. `DB_CONNECTION_LIMIT` caps open connections (default 10). |
| `APP_URL` | yes | The public URL of the app, e.g. `https://seo.example.com`. Used for Google sign-in callbacks, API examples and `npm run sync`. `AUTH_URL` still works as the old name. |
| `AUTH_SECRET` | yes | 32+ random characters. |
| `APP_ENCRYPTION_KEY` | yes | 64 hex characters. Encrypts the Google keys and tokens the app stores. |
| `DEMO_MODE`, `DEMO_EMAIL`, `DEMO_PASSWORD` | no | Demo sign-in button and the seeded account. |
| `ALLOW_SIGNUP` | no | Off unless set to `true`. Whoever registers gets the default role (Editor, which sees every project), so leave it off and use invitations. A server with no admin yet still accepts one sign-up, which becomes the Admin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Google sign-in, and connecting your own Google account for Search Console and GA4. Not needed if every project uses a service account. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | no | Email for invitation links, sent with nodemailer. Set `SMTP_HOST` and `SMTP_FROM` to turn it on. Without them, the admin copies the link and sends it. |
| `CRON_SECRET` | no | Protects the scheduled sync endpoint. |
| `TRUSTED_PROXY_HOPS` | no | How many reverse proxies sit in front of the app (default `1`). Rate limits use the visitor address from `X-Forwarded-For`, counted from the right. Use `0` if the app is exposed directly, so the header is ignored. |

Generate the secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # APP_ENCRYPTION_KEY
```

## Connecting Google (Search Console and GA4)

Rankings, clicks, impressions, queries and organic sessions all come from Google. A project reads them in one of two ways. It uses its own service account first, then its owner's Google connection.

### Option 1: a service account per project (for clients)

The client never signs in. You (or they) set it up once:

1. In [Google Cloud console](https://console.cloud.google.com/), create a project, enable the **Google Search Console API**, **Google Analytics Data API** and **Google Analytics Admin API**, create a **service account**, and download a **JSON key** for it.
2. In **Search Console → Settings → Users and permissions**, add the service account's email as a user. Restricted is enough.
3. In **GA4 → Admin → Property access management**, add the same email with the Viewer role.
4. In Seo Engine, open the project's **Project settings → Google access**, paste the JSON key (or choose the `.json` file) and click **Add key**. It is checked by signing in to Google and listing what the account can see, then stored encrypted. The service account's email is shown so it can be copied.
5. Pick the Search Console site and GA4 property under **Google properties** on the same page.

Anyone whose role has the **Google connection → Edit** permission (admins always) can add, replace or remove a project's key. If a stored key stops working, that project's sync reports an error. It never falls back to the owner's Google account, so one client's data can't end up in another's project.

### Option 2: your own Google account (OAuth)

1. Create an **OAuth client ID** (Web application) in the same Cloud project, with this redirect URI: `{APP_URL}/api/auth/callback/google`. While the consent screen is in "Testing", add your Google account as a test user.
2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart the server.
3. In **Google & API**, click **Connect Google**. This asks for read-only `webmasters.readonly` and `analytics.readonly` access with offline consent, so the daily sync can refresh the token.
4. In each project's **Project settings**, pick the Search Console site and the GA4 property.

GA4 is filtered to `sessionDefaultChannelGroup = Organic Search`, and conversions use GA4's `keyEvents` metric.

### What rank tracking means here

Search Console reports the **average position** your pages were shown at for a query, not a one-off live search result. A keyword gets a position on days it had at least one impression; days with none have no position. Search Console data runs about two days behind, and the project's device and country are applied as filters.

**Which page ranks.** Each day stores the page that got the most impressions for the keyword, so the Rankings table shows today's page and the keyword's change log shows when it switched. A keyword's page lists every page of the site that showed for it in the range, with impressions, share, clicks and average position. Rankings flags **Page changed** when the ranking page switched in the selected range, and **N pages compete** when two or more pages each get at least 20% of the keyword's impressions; the **Ranking page** filter narrows the table to either.

## Team, roles and client access

Each user has one role. A role decides what they can change (for example create projects, edit settings or manage API keys), and whether they **see every project**:

- The **Demo** role belongs to the public demo account (`DEMO_MODE`): it sees only its own sample project.
- **See every project** is on by default, so the Admin, Editor and Viewer roles, and any role you create, see all projects.
- **Turn it off** for a client role. That role sees only the projects it's been added to. Open a project's **Project settings → Who can see this project** and tick the people who should see it. The team's own admins always see everything.

A client's API key follows the same rules: it lists only the projects they can see, and any other project returns 404.

**Forgotten passwords.** The sign-in page has **Forgot password?**. Enter the email and, when email is set up (`SMTP_HOST` and `SMTP_FROM`), a one-time link valid for an hour is sent. The page answers the same way whether or not the address has an account. The link sets a new password, marks the address as verified and signs the account out everywhere else. Without email, or when someone can't receive it, an admin clicks **Reset password** next to the member on **Team & roles** and passes on the link shown there. Deactivated accounts get nothing.

**Rate limits.** Failed sign-ins are limited to 8 per account and 60 per address in 15 minutes (a successful sign-in clears the account's count). Sign-ups and invitation attempts are limited to 10 and 20 per address an hour, password reset requests to 3 per address and 10 per visitor an hour, and requests with a wrong API key to 100 per 15 minutes. Counters are kept in the database, so they hold across restarts and several instances, and they store only hashes, never email addresses. Set `TRUSTED_PROXY_HOPS` to match your proxy setup or every visitor may share one limit.

**Inviting people.** On **Team & roles**, click **Invite someone**, enter the email and pick the role. When email is set up (`SMTP_HOST` and `SMTP_FROM`), the invitation is emailed. Otherwise, or if sending fails, the one-time link is shown once for you to copy. Links are valid for 7 days. The person opens it, sets their name and password, and is signed in with that role. An invite works even when public sign-up is turned off (`ALLOW_SIGNUP="false"`), and the link only works for the invited email. Revoke a pending invitation from the same page.

**Deactivating people.** On **Team & roles**, **Deactivate** blocks sign-in and API keys at once, including sessions that are already open, and keeps everything the person created. **Reactivate** restores access. You can't deactivate your own account.

To give a client their own login: create a role with **See every project** turned off, invite them with the client role, then tick their projects under each project's **Who can see this project**.

### Referrals: backlink tracking without a paid API

There is no free way to see every backlink: that takes a crawler of the whole web. What GA4 does know is every visit that arrived from another website, so **Referrals** shows the links that work. For each site it shows sessions, users and conversions, the change against the previous period of the same length, the date it first sent a visit, and a **New** badge for sites that started in the selected range. **Gone quiet** lists sites that sent visits in the previous period and none now. **Referring pages** lists the exact pages from the last 28 days, so you can open one and check the link.

It needs the project's GA4 property (see above) and fills in on **Sync Google** or the daily sync, which keeps 6 months of history. The comparison is available for 7 days, 28 days and 3 months. **Export CSV** on that page saves the sites list for the selected range. A link nobody clicks never appears, and a drop can mean the link was removed or just stopped getting clicks. The page list is best-effort: if GA4 refuses that one request, the sites list is still updated and the sync reports a warning.

### Backlinks: import Search Console's Links report

Search Console shows who links to you, but Google offers no API for it, so **Backlinks** takes the export. In Search Console open **Links**, press **Export external links**, choose **Download CSV** (or Excel, then save as CSV), and upload the ZIP or the CSV files on the project's **Backlinks** page. The files can be in any language and use commas, semicolons or tabs. Each table is recognised by what it holds: top linking sites, top linked pages and top linking text. A file that is none of these (for example the internal links table) is skipped with a note.

Every upload is a snapshot with the date you exported it. The latest list of linking sites is compared with the one before it to show **New sites**, **Lost sites** and the change per site, and a chart appears once you have two uploads. Import again every month or so. Search Console only exports your top links, so a site that drops out can be a lost link or just one that fell below the cut. The last 24 imports are kept, and a role needs **Backlinks → Create** to upload and **Backlinks → Delete** to remove one. The data is also at `GET /api/v1/projects/{id}/backlinks`.

## Shopping (Merchant Center)

The **Shopping** page shows a store's Google Shopping results from its Merchant Center account through Google's Merchant API (v1): clicks, impressions, CTR and conversions per day and per product, for free listings, Shopping ads or both, compared with the previous period. Conversions are only reported for free listings. **Product health** counts approved, limited, pending and disapproved products, lists the issues behind them with Google's help links, and filters the products by status.

Setup for each project:

1. Enable the **Merchant API** in your Google Cloud project, next to the Search Console and Analytics APIs.
2. Give the project's Google access to the store's Merchant Center account. With a service account, add its email in Merchant Center under Settings, People and access, with Performance and insights (or Admin) access. With your own Google account, reconnect Google in Settings so it includes Merchant Center.
3. In Project settings, choose the **Merchant Center account**.
4. If Google asks for it, register the app once with **Register** on the Shopping page; this needs Admin access to the Merchant Center account.

Up to 5,000 products are read for Product health, and answers are reused for 5 minutes.

**Shipping & returns.** The **Shipping & returns** tab edits the account's shipping settings: services (delivery, local delivery, collection point), countries, currency, minimum order value, handling and transit days, cutoff times, business days, transit-time tables, warehouses, carrier rates, and rates as one value or as tables by price, weight, items or region with subtables. Saving replaces the shipping settings in Merchant Center in one go; if they were changed in Merchant Center meanwhile, nothing is overwritten and the latest version is loaded. The same tab manages regions (postal codes or geotargets) and return policies (Google can't update a policy, so an edit replaces it). Shopping is laid out in the sidebar like Merchant Center's own menu. Changes need the page's own Create, Edit or Delete permission under **Merchant Center** in a role (Admins have them all) and Admin or Standard access in Merchant Center; everyone else sees a read-only view.

**Marketing methods.** Shows each program (free listings, Shopping ads, checkout and others) with what it still needs, and turns eligible ones on or off.

**Notifications.** Lists every account issue Merchant Center reports, with details and help links; the Shopping overview shows the most important ones.

**Automatic improvements, Conversion settings, Apps and services.** Under Settings: turn Google's automatic price, availability, condition, image and shipping fixes on or off; list conversion sources, link a GA4 property (the project's is suggested), add a Merchant Center tag source, change its attribution model and lookback window, or remove one; see the linked Business Profile (and request a link by email), linked services such as Google Ads with approve or reject for pending requests, and connected accounts.

**Business info & access.** Edits the business name, address and customer service contacts; sets and claims the store homepage (with an option to take over a claim held by another account); and manages people and access in Merchant Center (invite, change access rights, remove; the last admin can't be removed). People and access needs Admin access to the Merchant Center account. The business phone is verified in Merchant Center, so it's shown but not editable.

**Products.** The **Products** tab lists the whole catalogue with search by title or product ID and a status filter. Opening a product shows where it shows on Google per destination and country, its issues with Google's help links, and its details. Feeds can't be edited through Google's API, so changes saved here (title, description, links, price, sale price, availability, condition, brand, GTINs) go into a supplemental data source named "Seo Engine edits", which the app creates and ranks first for that product's feed; only the changed fields are overridden, and **Revert my edits** removes them. **Add product** puts a product in an API data source named "Seo Engine products"; every row has Edit and Delete: products in an API data source are deleted, and feed products (which the API can't delete) are paused on Google, with Resume to undo. Google can take a few minutes to show changes.

**Feeds.** The **Feeds** tab lists every data source (primary and supplemental product feeds, promotions, inventory, reviews) with its input (API, file upload, scheduled URL fetch, Google Sheets, Merchant Center, autofeed), schedule, and the latest upload of file feeds: processing state, items processed, created and updated, and issues. Scheduled URL feeds can be fetched now, paused and resumed; **Add scheduled feed** creates one (daily, weekly or monthly, with an optional username and password); any data source can be deleted after a confirmation that says what goes with it.

**Promotions.** The **Promotions** tab lists promotions with their offer, dates, code, issues and status per destination (in review, scheduled, live, rejected, ended). **New promotion** creates a percent-off, amount-off or free-shipping promotion for all products or chosen product IDs, with optional code and minimum purchase, through a promotion data source per country and language ("Seo Engine promotions PK/en") created on first use; reusing an ID replaces that promotion. Google can't delete promotions, so **End now** ends one by setting its end time to now; promotions from files or Merchant Center itself are ended there.

**Analytics.** **Pricing** and **Best sellers** show, for the chosen country (the project's country by default), **price competitiveness** (your price next to the average price other stores show for the same product, most overpriced first) and **best sellers** (last week's most popular products on Google by category, with rank changes, demand, and whether you sell them). Google only offers these reports to eligible accounts; when one isn't available it says so instead of failing the page.

## First-login tour

A new user sees a short guided tour of the sidebar the first time they sign in (built with NextStepjs). It adapts to the user's role (Team and roles only for admins, a read-only note on Merchant Center for roles that can't edit it) and leaves out steps whose target isn't on screen. Finishing or skipping saves `tourSeenAt` on the user, so it isn't shown again; **Take the tour** in the user menu replays it. Existing users see it once after this update.

Every page also has a short tour of its own (what the page is for, its filters, one tip), shown the first time a user opens that page, after the welcome tour. Finished page tours are saved in `pageToursSeen`; **Tour of this page** in the user menu replays one. The text for each page lives in `src/lib/tour-pages.ts`: add an entry there when you add a page.

## Site audit

Open a project's **Site audit** page and click **Run audit**. It crawls the domain from the homepage and the sitemap, up to 50 pages, respecting `robots.txt`, and needs no API key. Results show a health score, what to fix grouped by issue, and a filterable table of pages. The last five runs per project are kept. Requests refuse private and loopback addresses, so the crawler can't be pointed at internal hosts.


**URL inspection.** On **Site audit**, type any page of the site into **URL inspection**, or click **Inspect** on a crawled page. It asks Search Console how Google sees that URL: whether it's on Google and why not, indexing and robots.txt, the last crawl, Google's chosen canonical next to yours (with a warning when they differ), sitemaps, mobile usability, rich results, and a link to the same view in Search Console. It needs the project's Search Console site, accepts only URLs inside that property, and is available to roles with **Site audit → Create**. Google allows about 2,000 inspections per site a day, so each project is limited to 200 an hour, and an answer is reused for 5 minutes.

## Deploying on Vercel

Vercel runs `npm run vercel-build` (scripts/vercel-build.mjs). On **production** deploys it applies pending database migrations with `prisma migrate deploy` before building, so the code never runs against an older schema. **Preview** deploys skip migrations, so a branch can't change the live database. If a migration fails, the build stops and the previous deployment stays live; Vercel's build log shows why.

For this to work, the database settings (`DB_*` or `DATABASE_URL`) must be set for the Production environment in Vercel, and the database must accept connections from Vercel's build servers. Set `SKIP_MIGRATIONS=true` to deploy without migrating.

## Scheduled sync

Rank checks and data pulls run when you click **Refresh** or **Check now**, and on a schedule through:

```
POST /api/cron/sync        Authorization: Bearer $CRON_SECRET
```

`npm run sync` calls it for you, using `APP_URL` and `CRON_SECRET` from `.env`. Run it once a day.

**Linux (crontab):**

```
0 6 * * * cd /opt/seo-engine && npm run sync >> /var/log/seo-engine-sync.log 2>&1
```

**Windows (Task Scheduler):** create a daily task that runs `cmd /c "cd /d D:\path\to\seo-engine && npm run sync"`.

## Self-hosting in production

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start            # listens on PORT (default 3000)
```

Put it behind a reverse proxy (Caddy, nginx) with HTTPS, set `APP_URL` to the public URL, and keep a process manager such as pm2 or systemd running `npm start`.

## API

Create a key in **Google & API**, then **API keys**. Send it as a bearer token:

```bash
curl -H "Authorization: Bearer bsk_..." http://localhost:3000/api/v1/projects
```

| Method | Path | What it returns |
|---|---|---|
| GET | `/api/v1/projects` | Your projects |
| GET | `/api/v1/projects/{id}/report?days=28` | Totals, daily GSC + GA4 + ranking series, top movers |
| GET | `/api/v1/projects/{id}/rankings?days=90&keyword=&tag=` | Ranking history per keyword |
| GET | `/api/v1/projects/{id}/referrals?days=28` | Sites and pages that sent visitors, with new and gone-quiet sites |
| GET | `/api/v1/projects/{id}/keywords` | Tracked keywords |
| POST | `/api/v1/projects/{id}/keywords` | Track keywords: `{ "keywords": [...], "tags": [...] }` |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1 spec (no auth needed) |

Keys are stored only as SHA-256 hashes, can be revoked, and reach only the projects their user can see.

## How the numbers are calculated

- **Visibility**: for each tracked keyword, the expected CTR at its current position times its search volume (every keyword counts equally when no volume is known), divided by the same sum if every keyword ranked #1. 100% means #1 everywhere.
- **Average position** counts only keywords that have a position. Keywords with no impressions are left out, not counted as 100.
- **Change** compares the first and last reading in the selected range. Entering or leaving the results counts from or to 101.

## Project layout

```
prisma/schema.prisma        data model (auth tables, project members, SEO data)
prisma/seed.ts              demo account + project, first admin
src/lib/providers/          Google (Search Console, GA4), service account and OAuth access
src/lib/audit/              site audit crawler and checks
src/lib/demo/               deterministic demo data
src/lib/sync.ts             rankings / google sync
src/lib/queries.ts          reads and report building
src/lib/actions/            server actions (zod-validated)
src/app/(app)/              dashboard pages
src/app/api/v1/             public REST API
src/app/api/cron/sync/      scheduled sync endpoint
```

## License

MIT
#   S e o - A n a l y t i c s 
 
 