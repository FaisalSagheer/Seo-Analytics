import "server-only";
import { dateKeys, toDateKey } from "@/lib/dates";
import type { Window } from "@/lib/date-range";
import { getGoogleAccessToken, getGoogleSource } from "@/lib/providers";
import {
  GoogleApiError,
  getAccount,
  getBusinessInfo,
  getHomepage,
  getShippingSettings,
  latestFileUpload,
  listDataSources,
  listPromotions,
  getAutomaticImprovements,
  listAccountServices,
  listConversionSources,
  listGbpAccounts,
  listRelationships,
  type AccountServiceDoc,
  type AutomaticImprovementsDoc,
  type ConversionSourceDoc,
  type GbpAccountDoc,
  type RelationshipDoc,
  listProductReviews,
  type ProductReviewDoc,
  bestSellers,
  priceCompetitiveness,
  type BestSellerRow,
  type PriceCompetitivenessRow,
  type PromotionDoc,
  type DataSourceDoc,
  type FileUploadDoc,
  listPrograms,
  listUsers,
  type BusinessInfoDoc,
  type HomepageDoc,
  type ProgramDoc,
  type UserDoc,
  listAccountIssues,
  listRegions,
  listReturnPolicies,
  type AccountIssue,
  listMerchantProducts,
  merchantDaily,
  merchantProductPerformance,
  type MarketingMethod,
  type StoreType,
  type MerchantProduct,
  type ProductHealthStatus,
  type ProductIssue,
} from "@/lib/providers/google";

export type MethodFilter = "all" | "ORGANIC" | "ADS";
export type ShoppingTotals = { clicks: number; impressions: number; ctr: number; conversions: number };
export type ShoppingProblem = { kind: "api" | "scope" | "registration" | "access" | "other"; message: string };

type Project = { id: string; userId: string; merchantId: string | null };

/** Turns a Merchant API failure into what the person can do about it. */
export async function merchantProblem(err: unknown, project: Project): Promise<ShoppingProblem> {
  const message = err instanceof Error ? err.message : String(err);
  const status = err instanceof GoogleApiError ? err.status : 0;
  // Checked before the 403 handling below: a disabled API is also a 403, but the fix is in Google Cloud
  if (/SERVICE_DISABLED|has not been used in project|it is disabled|accessNotConfigured|API has not been enabled/i.test(message)) {
    return {
      kind: "api",
      message: "The Merchant API isn't enabled in this app's Google Cloud project. In the Google Cloud console, open APIs & Services → Library, enable \"Merchant API\", wait a few minutes, then try again.",
    };
  }
  if (/insufficient.*scope|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(message)) {
    return { kind: "scope", message: "This project's Google connection doesn't include Merchant Center yet. Reconnect Google in Settings → Google & API." };
  }
  if (/regist/i.test(message) && /(GCP|Cloud project|developer)/i.test(message)) {
    return {
      kind: "registration",
      message: "Google asks for this app's Google Cloud project to be registered with the Merchant Center account once. Someone with Admin access to the account can do it with Register.",
    };
  }
  if (status === 403 || status === 401 || /PERMISSION_DENIED|does not have access|not have permission/i.test(message)) {
    const source = await getGoogleSource(project).catch(() => null);
    const who = source?.source === "project" && source.email ? source.email : "the Google account connected for this project";
    return {
      kind: "access",
      message: `Merchant Center refused access. In Merchant Center → Settings → People and access, add ${who} with Performance and insights (or Admin) access. Google said: ${message}`,
    };
  }
  return { kind: "other", message: `Merchant Center: ${message}` };
}

const ZERO: ShoppingTotals = { clicks: 0, impressions: 0, ctr: 0, conversions: 0 };

function totalsOf(rows: { clicks: number; impressions: number; conversions: number }[]): ShoppingTotals {
  const t = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions, conversions: a.conversions + r.conversions }), {
    clicks: 0,
    impressions: 0,
    conversions: 0,
  });
  return { ...t, ctr: t.impressions ? t.clicks / t.impressions : 0 };
}

const keep = (filter: MethodFilter) => (m: MarketingMethod) => filter === "all" || m === filter;

export type ShoppingPerformance = {
  totals: ShoppingTotals;
  previous: ShoppingTotals | null;
  /** One point per day, gaps filled with zeros */
  series: { date: string; clicks: number; impressions: number }[];
  /** Clicks and impressions by marketing method for the range, ignoring the method filter */
  byMethod: { method: MarketingMethod; clicks: number; impressions: number }[];
  products: { offerId: string; title: string; clicks: number; impressions: number; ctr: number; conversions: number }[];
};

/** Clicks, impressions and conversions from Merchant Center for the range and, if given, the comparison range. */
export async function loadShoppingPerformance(
  project: Project,
  opts: { window: Window; previous: Window | null; method: MethodFilter; store?: StoreType },
): Promise<{ data: ShoppingPerformance | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  const id = project.merchantId;
  const start = toDateKey(opts.window.start);
  const end = toDateKey(opts.window.end);
  try {
    const token = await getGoogleAccessToken(project);
    const [days, prevDays, productRows] = await Promise.all([
      merchantDaily(token, id, start, end, opts.store),
      opts.previous ? merchantDaily(token, id, toDateKey(opts.previous.start), toDateKey(opts.previous.end), opts.store) : Promise.resolve(null),
      merchantProductPerformance(token, id, start, end, opts.store),
    ]);
    const wanted = keep(opts.method);
    const shown = days.filter((d) => wanted(d.method));

    const perDay = new Map<string, { clicks: number; impressions: number }>();
    for (const d of shown) {
      const p = perDay.get(d.date) ?? { clicks: 0, impressions: 0 };
      p.clicks += d.clicks;
      p.impressions += d.impressions;
      perDay.set(d.date, p);
    }
    const series = dateKeys(opts.window.start, opts.window.end).map((date) => ({ date, ...(perDay.get(date) ?? { clicks: 0, impressions: 0 }) }));

    const methods = new Map<MarketingMethod, { clicks: number; impressions: number }>();
    for (const d of days) {
      const m = methods.get(d.method) ?? { clicks: 0, impressions: 0 };
      m.clicks += d.clicks;
      m.impressions += d.impressions;
      methods.set(d.method, m);
    }

    const perProduct = new Map<string, { offerId: string; title: string; clicks: number; impressions: number; conversions: number }>();
    for (const r of productRows.filter((r) => wanted(r.method))) {
      const p = perProduct.get(r.offerId) ?? { offerId: r.offerId, title: r.title, clicks: 0, impressions: 0, conversions: 0 };
      p.clicks += r.clicks;
      p.impressions += r.impressions;
      p.conversions += r.conversions;
      perProduct.set(r.offerId, p);
    }
    const products = [...perProduct.values()]
      .map((p) => ({ ...p, ctr: p.impressions ? p.clicks / p.impressions : 0 }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 500);

    return {
      data: {
        totals: shown.length ? totalsOf(shown) : ZERO,
        previous: prevDays ? totalsOf(prevDays.filter((d) => wanted(d.method))) : null,
        series,
        byMethod: [...methods].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.clicks - a.clicks),
        products,
      },
    };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type IssueSummary = { code: string; description: string; severity: ProductIssue["severity"]; documentation: string | null; products: number };

export type ProductHealth = {
  counts: Record<ProductHealthStatus, number>;
  total: number;
  /** More products than were read; counts cover the products read */
  truncated: boolean;
  issues: IssueSummary[];
  /** Products that aren't fully approved, worst first (capped for the page) */
  problems: MerchantProduct[];
};

const STATUS_RANK: Record<ProductHealthStatus, number> = { DISAPPROVED: 0, LIMITED: 1, PENDING: 2, APPROVED: 3 };
const SEVERITY_RANK: Record<ProductIssue["severity"], number> = { DISAPPROVED: 0, DEMOTED: 1, NOT_IMPACTED: 2 };

/** Approved, limited, pending and disapproved products, and the issues behind them. */
export async function loadProductHealth(project: Project): Promise<{ data: ProductHealth | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const { products, truncated } = await listMerchantProducts(token, project.merchantId);
    const counts: Record<ProductHealthStatus, number> = { APPROVED: 0, LIMITED: 0, PENDING: 0, DISAPPROVED: 0 };
    const issues = new Map<string, IssueSummary>();
    for (const p of products) {
      counts[p.status]++;
      for (const i of p.issues) {
        const s = issues.get(i.code) ?? { code: i.code, description: i.description, severity: i.severity, documentation: i.documentation, products: 0 };
        s.products++;
        if (SEVERITY_RANK[i.severity] < SEVERITY_RANK[s.severity]) s.severity = i.severity;
        issues.set(i.code, s);
      }
    }
    return {
      data: {
        counts,
        total: products.length,
        truncated,
        issues: [...issues.values()].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.products - a.products),
        problems: products
          .filter((p) => p.status !== "APPROVED" || p.issues.length > 0)
          .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.issues.length - a.issues.length)
          .slice(0, 2000),
      },
    };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Account-level warnings for the banner on every Shopping tab; a failure here just hides the banner. */
export async function loadAccountIssues(project: Project): Promise<AccountIssue[]> {
  if (!project.merchantId) return [];
  try {
    return await listAccountIssues(await getGoogleAccessToken(project), project.merchantId);
  } catch {
    return [];
  }
}

export type ShippingPage = {
  settings: import("@/lib/merchant-shipping").ShippingSettings;
  regions: import("@/lib/merchant-shipping").Region[];
  policies: import("@/lib/merchant-shipping").ReturnPolicy[];
};

/** Everything the Shipping & returns tab edits, read fresh (never from the cache). */
export async function loadShippingPage(project: Project): Promise<{ data: ShippingPage | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const [settings, regions, policies] = await Promise.all([
      getShippingSettings(token, project.merchantId),
      listRegions(token, project.merchantId),
      listReturnPolicies(token, project.merchantId),
    ]);
    return { data: { settings, regions, policies } };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type SettingsPage = { accountName: string; info: BusinessInfoDoc; homepage: HomepageDoc };

/** Settings → Business info: the business name, address, customer service and homepage. */
export async function loadSettingsPage(project: Project): Promise<{ data: SettingsPage | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const id = project.merchantId;
    const [account, info, homepage] = await Promise.all([getAccount(token, id), getBusinessInfo(token, id), getHomepage(token, id)]);
    return { data: { accountName: account.accountName ?? "", info, homepage } };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type CatalogueRow = { name: string; offerId: string; title: string; imageLink: string | null; availability: string | null; status: ProductHealthStatus; issues: number; videos: string[] };

/** The Products tab: every product, slimmed for the browser (details load when one is opened). */
export async function loadCatalogue(project: Project): Promise<{ data: { rows: CatalogueRow[]; truncated: boolean } | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const { products, truncated } = await listMerchantProducts(token, project.merchantId);
    const rows = products.map((p) => ({ name: p.name, offerId: p.offerId, title: p.title, imageLink: p.imageLink, availability: p.availability, status: p.status, issues: p.issues.length, videos: p.videoLinks }));
    return { data: { rows, truncated } };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type FeedRow = DataSourceDoc & { upload: FileUploadDoc | null };

/** The Feeds tab: every data source, with the latest upload of file feeds. */
export async function loadFeeds(project: Project): Promise<{ data: FeedRow[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const sources = await listDataSources(token, project.merchantId);
    const data = await Promise.all(sources.map(async (d) => ({ ...d, upload: d.input === "FILE" && d.name ? await latestFileUpload(token, d.name) : null })));
    return { data };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** The Promotions tab, with whether each promotion's source is one the app can write to. */
export async function loadPromotions(
  project: Project,
): Promise<{ data: (PromotionDoc & { editable: boolean })[] | null; problem?: ShoppingProblem; unavailable?: string }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    // Data sources first: if they load, the account is reachable and a refusal below is about promotions only
    const sources = await listDataSources(token, project.merchantId);
    let promos: PromotionDoc[];
    try {
      promos = await listPromotions(token, project.merchantId);
    } catch (err) {
      if (err instanceof GoogleApiError && err.status === 403) return { data: null, unavailable: err.message };
      throw err;
    }
    const api = new Set(sources.filter((d) => d.input === "API").map((d) => d.name));
    return { data: promos.map((p) => ({ ...p, editable: api.has(p.dataSource) })) };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

type Insight<T> = { rows: T[] } | { note: string };

/** A market-insights report that isn't available is a note, not a failure: most stores aren't eligible for every report. */
async function insight<T>(project: Project, run: () => Promise<T[]>): Promise<Insight<T>> {
  try {
    return { rows: await run() };
  } catch (err) {
    const p = await merchantProblem(err, project);
    // Not being eligible for a report (often a 403) isn't an access problem with the account
    const raw = err instanceof Error ? err.message : "";
    if (p.kind !== "other" && !/eligib|market insights|not available|not enabled for/i.test(raw)) throw err;
    return { note: p.kind === "other" ? p.message : `Merchant Center: ${raw}` };
  }
}

/** The Insights tab for one country (two-letter, upper case). */
export async function loadInsights(
  project: Project,
  country: string,
  report: "prices" | "sellers",
): Promise<{ data: { prices?: Insight<PriceCompetitivenessRow>; sellers?: Insight<BestSellerRow> } | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  if (!/^[A-Z]{2}$/.test(country)) return { data: null };
  const id = project.merchantId;
  try {
    const token = await getGoogleAccessToken(project);
    if (report === "prices") return { data: { prices: await insight(project, () => priceCompetitiveness(token, id, country)) } };
    return { data: { sellers: await insight(project, () => bestSellers(token, id, country)) } };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Marketing methods: the programs (free listings, Shopping ads, …) and what each still needs. */
export async function loadPrograms(project: Project): Promise<{ data: ProgramDoc[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    return { data: await listPrograms(await getGoogleAccessToken(project), project.merchantId) };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Reviews: product reviews sent to Merchant Center (from a review aggregator or the store's own source). */
export async function loadReviews(project: Project): Promise<{ data: ProductReviewDoc[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    return { data: await listProductReviews(await getGoogleAccessToken(project), project.merchantId) };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Settings → People and access. Listing people needs Admin rights in Merchant Center; without them it's `null`. */
export async function loadPeople(project: Project): Promise<{ data: UserDoc[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    return { data: await listUsers(await getGoogleAccessToken(project), project.merchantId) };
  } catch (err) {
    if (err instanceof GoogleApiError && err.status === 403) return { data: null };
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Settings → Automatic improvements. */
export async function loadAutomaticImprovements(project: Project): Promise<{ data: AutomaticImprovementsDoc | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    return { data: await getAutomaticImprovements(await getGoogleAccessToken(project), project.merchantId) };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

/** Settings → Conversion settings: the account's conversion sources (Google Analytics links and the Merchant Center tag). */
export async function loadConversionSources(project: Project): Promise<{ data: ConversionSourceDoc[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    return { data: await listConversionSources(await getGoogleAccessToken(project), project.merchantId) };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type AppsPage = { gbp: GbpAccountDoc[] | null; services: AccountServiceDoc[]; relationships: RelationshipDoc[] };

/** Settings → Apps and services. Business Profile accounts need the right Google login, so a refusal there is shown as unavailable. */
export async function loadAppsAndServices(project: Project): Promise<{ data: AppsPage | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const id = project.merchantId;
    const [gbp, services, relationships] = await Promise.all([
      listGbpAccounts(token, id).catch((err) => {
        if (err instanceof GoogleApiError && (err.status === 403 || err.status === 404)) return null;
        throw err;
      }),
      listAccountServices(token, id),
      listRelationships(token, id),
    ]);
    return { data: { gbp, services, relationships } };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}

export type QualityCheck = { id: string; label: string; ok: boolean; detail: string; fix: string };

/**
 * Settings that feed Google's store quality ratings, checked from Merchant Center data. Google's own
 * ratings (shipping, returns, customer service) aren't in its API, so this is a checklist, not that score.
 */
export async function loadStoreQuality(project: Project): Promise<{ data: QualityCheck[] | null; problem?: ShoppingProblem }> {
  if (!project.merchantId) return { data: null };
  try {
    const token = await getGoogleAccessToken(project);
    const id = project.merchantId;
    const [homepage, info, shipping, policies, issues, products, improvements] = await Promise.all([
      getHomepage(token, id),
      getBusinessInfo(token, id),
      getShippingSettings(token, id),
      listReturnPolicies(token, id),
      listAccountIssues(token, id),
      listMerchantProducts(token, id),
      getAutomaticImprovements(token, id).catch(() => ({}) as AutomaticImprovementsDoc),
    ]);
    const services = (shipping.services ?? []).filter((s) => s.active !== false);
    const shipCountries = [...new Set(services.flatMap((s) => s.deliveryCountries ?? []))];
    const returnCountries = new Set(policies.flatMap((p) => p.countries ?? []));
    const noReturns = shipCountries.filter((c) => !returnCountries.has(c));
    const timed = services.filter((s) => s.deliveryTime?.maxTransitDays != null || s.deliveryTime?.transitTimeTable || s.deliveryTime?.warehouseBasedDeliveryTimes?.length);
    const cs = info.customerService ?? {};
    const total = products.products.length;
    const approved = products.products.filter((p) => p.status === "APPROVED").length;
    const rate = total ? approved / total : 1;
    const serious = issues.filter((i) => i.severity === "CRITICAL" || i.severity === "ERROR");
    const items = improvements.itemUpdates;
    const autoOn = Boolean(items?.accountItemUpdatesSettings?.allowPriceUpdates ?? items?.effectiveAllowPriceUpdates) && Boolean(items?.accountItemUpdatesSettings?.allowAvailabilityUpdates ?? items?.effectiveAllowAvailabilityUpdates);
    const fix = (segment: string) => `/projects/${project.id}/shopping/${segment}`;
    return {
      data: [
        { id: "homepage", label: "Website claimed", ok: Boolean(homepage.claimed), detail: homepage.claimed ? `${homepage.uri} is claimed.` : homepage.uri ? `${homepage.uri} isn't claimed yet.` : "No website set.", fix: fix("settings") },
        {
          id: "phone",
          label: "Business phone verified",
          ok: info.phoneVerificationState === "PHONE_VERIFICATION_STATE_VERIFIED",
          detail: info.phone?.e164Number ? (info.phoneVerificationState === "PHONE_VERIFICATION_STATE_VERIFIED" ? "Verified." : "Set but not verified; verify it in Merchant Center.") : "No business phone.",
          fix: fix("settings"),
        },
        {
          id: "contact",
          label: "Customer service contact",
          ok: Boolean(cs.email || cs.uri || cs.phone?.e164Number),
          detail: [cs.email && "email", cs.phone?.e164Number && "phone", cs.uri && "page"].filter(Boolean).join(", ") || "No email, phone or page for customers.",
          fix: fix("settings"),
        },
        { id: "shipping", label: "Shipping set up", ok: services.length > 0, detail: services.length ? `${services.length} service${services.length === 1 ? "" : "s"} to ${shipCountries.join(", ") || "no countries"}.` : "No active shipping services.", fix: fix("shipping") },
        { id: "delivery", label: "Delivery times given", ok: services.length > 0 && timed.length === services.length, detail: services.length ? `${timed.length} of ${services.length} services state delivery times.` : "No shipping services.", fix: fix("shipping") },
        {
          id: "returns",
          label: "Return policy for every country you ship to",
          ok: policies.length > 0 && noReturns.length === 0,
          detail: policies.length === 0 ? "No return policy." : noReturns.length ? `Missing for ${noReturns.join(", ")}.` : `Covers ${[...returnCountries].join(", ")}.`,
          fix: fix("shipping"),
        },
        { id: "products", label: "Most products approved (90%+)", ok: rate >= 0.9, detail: total ? `${approved.toLocaleString()} of ${total.toLocaleString()} approved (${Math.round(rate * 100)}%).` : "No products yet.", fix: fix("products") },
        { id: "issues", label: "No serious account issues", ok: serious.length === 0, detail: serious.length ? serious.map((i) => i.title).slice(0, 3).join("; ") : "None reported.", fix: fix("notifications") },
        { id: "auto", label: "Automatic price and availability updates", ok: autoOn, detail: autoOn ? "On: Google keeps them matched to the website." : "Off: mismatches with the website can get products disapproved.", fix: fix("automatic-improvements") },
      ],
    };
  } catch (err) {
    return { data: null, problem: await merchantProblem(err, project) };
  }
}
