/** The short tour each page shows the first time a user opens it. Keys come from pageKey(). */
export type PageTour = {
  /** Shown on the page title: what this page is for */
  intro: string;
  /** Shown on the filters at the top right, when the page has any */
  filters?: string;
  /** A closing tip, shown in the middle of the screen */
  tip?: string;
};

export const PAGE_TOURS: Record<string, PageTour> = {
  projects: {
    intro: "All your websites. Open one to see its search, traffic and shopping data.",
    tip: "Use the project switcher at the top of the sidebar to move between websites quickly.",
  },
  account: {
    intro: "Connect your Google account and manage API keys. Do this first: the numbers fill in once Google is connected.",
  },
  team: {
    intro: "Add people to the team and choose what each role is allowed to do.",
  },
  overview: {
    intro: "A snapshot of how this website is doing: visibility, average position, clicks and sessions.",
    filters: "Pick the country and the period. Everything on the page updates, and each card compares with the previous period.",
    tip: "Open Performance, Rankings or Reports in the sidebar for the detail behind these numbers.",
  },
  performance: {
    intro: "Clicks and impressions from Google Search, next to visitors from Google Analytics.",
    filters: "Choose the period, the country and how the chart is grouped (hourly, daily, weekly or monthly). Sync Google refreshes the numbers.",
    tip: "Scroll down for your top pages, countries, devices and search queries. The newest day or two can still change.",
  },
  rankings: {
    intro: "Where your pages rank on Google for the keywords you track.",
    filters: "Check now refreshes positions. Add keywords starts tracking new ones.",
    tip: "Click a keyword to see its history and which page ranks for it. Tags and filters help with long lists.",
  },
  "rankings/keyword": {
    intro: "The ranking history of one keyword, and the page that ranks for it.",
    filters: "Change the period to zoom the history in or out.",
  },
  referrals: {
    intro: "Other websites that send you visitors.",
    filters: "Pick the period, export the list as a CSV, or sync Google.",
    tip: "\"Gone quiet\" means a site used to send visitors and has stopped. It's worth a look.",
  },
  backlinks: {
    intro: "Websites that link to yours. Google has no API for links, so you import the file from Search Console.",
    tip: "In Search Console open Links, export external links, then upload the file here. Import again about once a month to see what changed.",
  },
  audit: {
    intro: "Crawls your site and checks it for problems like missing titles, broken links and slow pages.",
    filters: "Re-run audit crawls the site again. Export CSV downloads the results.",
    tip: "Fix errors first, then warnings. Use URL inspection to see how Google sees one page.",
  },
  reports: {
    intro: "Visitors by channel, landing page, country and device, from Google Analytics.",
    filters: "Choose the period and whether to compare it with an earlier one.",
    tip: "Channels covers all traffic. Landing pages, countries and devices show organic search only.",
  },
  settings: {
    intro: "This project's name, domain, country, device and Google connections.",
    tip: "Choose your Search Console site, Analytics property and Merchant Center account here. Nothing shows until they're set.",
  },
  shopping: {
    intro: "Your Google Shopping results and product health at a glance.",
    filters: "Pick the period, whether to show free listings or Shopping ads, and all stores, the online store or physical stores.",
    tip: "The chart shows clicks per day. Product health lists approved, limited and disapproved products. Notifications in the sidebar lists everything that needs attention.",
  },
  "shopping/notifications": {
    intro: "Everything in your store that needs attention, most serious first.",
    tip: "Use the filter to focus on one kind of issue, then Open to go and fix it.",
  },
  "shopping/products": {
    intro: "Your whole product catalogue.",
    tip: "Click a product to edit it. Changes are saved to Google and can take a few minutes to show. Revert my edits undoes them, and the bin pauses or deletes a product.",
  },
  "shopping/shipping": {
    intro: "Shipping services, return policies and regions.",
    tip: "Shipping saves to Google in one go with Save shipping. If someone changed it meanwhile, you'll see their version instead of overwriting it.",
  },
  "shopping/store-quality": {
    intro: "A checklist of what shapes Google's store quality rating.",
    tip: "Fix opens the right page for each failed check. Google's own ratings are one click away at the top right.",
  },
  "shopping/reviews": {
    intro: "Product reviews sent to Google for your ratings.",
    tip: "Filter by stars or by reviews with issues. Reviews appear once your store is in Google's product ratings program.",
  },
  "shopping/product-studio": {
    intro: "AI help with product titles, descriptions and images.",
    tip: "Search for a product, ask for suggestions, then use the one you like. Nothing changes until you do.",
  },
  "shopping/video-assets": {
    intro: "Which products have videos, and where to add them.",
    tip: "The pencil sets a product's video links, one per line. Clear it to go back to the feed's videos.",
  },
  "shopping/promotions": {
    intro: "Offers shown with your products on Google.",
    tip: "New promotion starts one. Google can't delete promotions, so End now stops one early.",
  },
  "shopping/ad-campaigns": {
    intro: "Results from Shopping ads and the Google Ads accounts linked to your store.",
    filters: "Pick the period. Only Shopping ads are counted here.",
    tip: "Budgets and bids are managed in Google Ads. Open Google Ads takes you there.",
  },
  "shopping/brand": {
    intro: "The labels Google can show with your store, and the brands in your catalogue.",
    tip: "Only tick labels that describe the business. Products without a brand can be limited on Google.",
  },
  "shopping/marketing-methods": {
    intro: "Where your products can show on Google.",
    tip: "Switch a program on or off. A program marked Setup required needs something finished first, and says what.",
  },
  "shopping/product-performance": {
    intro: "Clicks, impressions and conversions for each product.",
    filters: "Pick the period, free listings or Shopping ads, and all stores, the online store or physical stores.",
  },
  "shopping/pricing": {
    intro: "Your price next to the average price other stores show for the same product.",
    filters: "Pick the country. Google only has data for some countries.",
  },
  "shopping/best-sellers": {
    intro: "The most popular products on Google last week, and whether you sell them.",
    filters: "Pick the country. Google only has data for some countries.",
  },
  "shopping/settings": {
    intro: "Your business name, address, customer service details and homepage.",
    tip: "Claim your homepage here: products can only show on Google once it's claimed.",
  },
  "shopping/feeds": {
    intro: "Where Merchant Center gets your products, promotions and inventory.",
    tip: "Fetch now refreshes a scheduled feed straight away. Add scheduled feed connects a new file.",
  },
  "shopping/people": {
    intro: "Who can use your Merchant Center account, and what they can do.",
    tip: "Add person sends an invitation. The last admin can't be removed.",
  },
  "shopping/apps": {
    intro: "Your linked Business Profile, Google Ads accounts and other services.",
    tip: "Approve or reject link requests that are waiting for you.",
  },
  "shopping/conversions": {
    intro: "Where Merchant Center gets sales and other conversions from.",
    tip: "Link Google Analytics to report conversions, or add a Merchant Center tag for your website.",
  },
  "shopping/automatic-improvements": {
    intro: "Let Google correct products from what it finds on your website.",
    tip: "Tick what Google may fix, then Save. This helps products avoid being disapproved for mismatches.",
  },
};

/** Which page tour applies to a URL path, or null when the page has none. */
export function pageKey(pathname: string): string | null {
  if (pathname === "/projects") return "projects";
  if (pathname === "/settings") return "account";
  if (pathname === "/team") return "team";
  const m = pathname.match(/^\/projects\/[^/]+(?:\/(.*))?$/);
  if (!m) return null;
  const rest = (m[1] ?? "").replace(/\/$/, "");
  if (rest === "") return "overview";
  if (/^rankings\/[^/]+$/.test(rest)) return "rankings/keyword";
  return rest in PAGE_TOURS ? rest : null;
}
