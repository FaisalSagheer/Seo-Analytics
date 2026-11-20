"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denied, requireProject } from "@/lib/session";
import { propertyChoiceDenied } from "@/lib/google-access";
import { getGoogleAccessToken } from "@/lib/providers";
import {
  GoogleApiError,
  editProductImage,
  suggestProductText,
  createConversionSource,
  decideAccountService,
  deleteConversionSource,
  linkGbpAccount,
  patchConversionSource,
  updateAutomaticImprovements,
  type AttributionModel,
  createDataSource,
  deleteDataSource,
  deleteProductInput,
  deleteProductReview,
  fetchDataSourceNow,
  getDataSource,
  getProduct,
  insertProductInput,
  insertPromotion,
  listPromotions,
  listDataSources,
  patchDataSource,
  patchProductInput,
  type DataSourceDoc,
  type ProductDoc,
  claimHomepage,
  createUser,
  deleteUser,
  setProgram,
  unclaimHomepage,
  renameAccount,
  updateBusinessInfo,
  updateHomepage,
  updateUser,
  type AccessRight,
  type BusinessInfoDoc,
  createRegion,
  createReturnPolicy,
  deleteRegion,
  deleteReturnPolicy,
  getShippingSettings,
  insertShippingSettings,
  listRegions,
  listReturnPolicies,
  updateRegion,
} from "@/lib/providers/google";
import { checkReturnPolicy, checkShipping, type Region, type ReturnPolicy, type ShippingSettings } from "@/lib/merchant-shipping";
import { merchantProblem } from "@/lib/shopping";
import { checkPromotion, toPromotion, type PromotionForm } from "@/lib/merchant-promotions";
import { attributeValue, changedFields, checkProduct, inputSegment, toForm, validOfferId, type ProductForm } from "@/lib/merchant-products";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

/** Every Merchant Center write: the permission, the project, its account, then the token. */
async function writeContext(projectId: string) {
  const blocked = await denied("merchant.manage");
  if (blocked) return { error: blocked };
  const { project } = await requireProject(projectId);
  if (!project.merchantId) return { error: fail("Choose a Merchant Center account in Project settings first.") };
  const notYours = await propertyChoiceDenied(project);
  if (notYours) return { error: notYours };
  return { project, merchantId: project.merchantId, token: await getGoogleAccessToken(project) };
}

/** After a write the 5-minute cache would show the old answer; drop it. */
async function afterWrite(projectId: string) {
  await db.providerCache.deleteMany({});
  revalidatePath(`/projects/${projectId}`, "layout");
}

const explain = async (err: unknown, project: { id: string; userId: string; merchantId: string | null }) => fail((await merchantProblem(err, project)).message);

// Names come from the browser: they must belong to this project's account
const ownedBy = (name: string, merchantId: string, kind: "regions" | "onlineReturnPolicies" | "programs" | "users" | "dataSources" | "productReviews" | "services") =>
  new RegExp(`^accounts/${merchantId}/${kind}/${kind === "users" ? "[^/\\s]+@[^/\\s]+" : kind === "services" ? "[^/\\s]+" : "[A-Za-z0-9_-]+"}$`).test(name);

// ---- shipping ----

/** Saves the whole shipping document. A stale etag (changed elsewhere) returns the latest version instead. */
export async function saveShippingSettings(
  projectId: string,
  settings: ShippingSettings,
): Promise<ActionResult<{ settings: ShippingSettings; conflict: boolean }>> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  try {
    const regions = await listRegions(ctx.token, ctx.merchantId);
    const problems = checkShipping(settings, regions.map((r) => r.name?.split("/").pop() ?? ""));
    if (problems.length) return fail(problems.slice(0, 5).join(" "));
    const saved = await insertShippingSettings(ctx.token, ctx.merchantId, { ...settings, name: undefined });
    await afterWrite(projectId);
    return ok({ settings: saved, conflict: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if ((err instanceof GoogleApiError && (err.status === 409 || err.status === 412)) || /etag|ABORTED|concurrent|has been modified/i.test(message)) {
      return ok({ settings: await getShippingSettings(ctx.token, ctx.merchantId), conflict: true });
    }
    return explain(err, ctx.project);
  }
}

// ---- regions ----

export type RegionInput = {
  displayName: string;
  /** postal: a country and postal code ranges; geo: Google geotarget IDs */
  kind: "postal" | "geo";
  regionCode?: string;
  ranges?: { begin: string; end?: string }[];
  geotargetIds?: string[];
};

function regionBody(input: RegionInput): { body: Region; error?: string } {
  if (!input.displayName.trim()) return { body: {}, error: "Name the region." };
  if (input.kind === "postal") {
    const ranges = (input.ranges ?? []).filter((r) => r.begin.trim());
    if (!/^[A-Z]{2}$/.test(input.regionCode ?? "")) return { body: {}, error: "Choose the region's 2-letter country code." };
    if (!ranges.length) return { body: {}, error: "Add at least one postal code or range." };
    return {
      body: {
        displayName: input.displayName.trim(),
        postalCodeArea: { regionCode: input.regionCode, postalCodes: ranges.map((r) => ({ begin: r.begin.trim(), ...(r.end?.trim() ? { end: r.end.trim() } : {}) })) },
      },
    };
  }
  const ids = (input.geotargetIds ?? []).map((s) => s.trim()).filter(Boolean);
  if (!ids.length || ids.some((id) => !/^\d+$/.test(id))) return { body: {}, error: "Enter Google geotarget IDs (numbers)." };
  return { body: { displayName: input.displayName.trim(), geotargetArea: { geotargetCriteriaIds: ids } } };
}

export async function addRegion(projectId: string, regionId: string, input: RegionInput): Promise<ActionResult> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(regionId)) return fail("The region ID can use letters, numbers, - and _ (up to 64).");
  const { body, error } = regionBody(input);
  if (error) return fail(error);
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  try {
    await createRegion(ctx.token, ctx.merchantId, regionId, body);
  } catch (err) {
    return explain(err, ctx.project);
  }
  await afterWrite(projectId);
  return ok(undefined);
}

export async function editRegion(projectId: string, name: string, input: RegionInput): Promise<ActionResult> {
  const { body, error } = regionBody(input);
  if (error) return fail(error);
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(name, ctx.merchantId, "regions")) return fail("That region isn't part of this project's Merchant Center account.");
  try {
    await updateRegion(ctx.token, name, body, ["displayName", input.kind === "postal" ? "postalCodeArea" : "geotargetArea"]);
  } catch (err) {
    return explain(err, ctx.project);
  }
  await afterWrite(projectId);
  return ok(undefined);
}

export async function removeRegion(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(name, ctx.merchantId, "regions")) return fail("That region isn't part of this project's Merchant Center account.");
  try {
    await deleteRegion(ctx.token, name);
  } catch (err) {
    return explain(err, ctx.project);
  }
  await afterWrite(projectId);
  return ok(undefined);
}

// ---- return policies ----

/** Only what Google accepts on create: output-only fields are dropped. */
const forCreate = (p: ReturnPolicy): ReturnPolicy => {
  const { name: _name, returnPolicyId: _id, ...rest } = p;
  void _name;
  void _id;
  return rest;
};

/**
 * Creates a policy, or replaces one (Google has no update). Replacing tries the new policy first so a
 * failure leaves the old one; if Google refuses because the label is taken, the old one goes first and
 * is restored should the new one fail.
 */
export async function saveReturnPolicy(projectId: string, policy: ReturnPolicy, replaceName?: string): Promise<ActionResult> {
  const problems = checkReturnPolicy(policy);
  if (problems.length) return fail(problems.join(" "));
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (replaceName && !ownedBy(replaceName, ctx.merchantId, "onlineReturnPolicies")) return fail("That return policy isn't part of this project's Merchant Center account.");
  const body = forCreate(policy);
  try {
    if (!replaceName) {
      await createReturnPolicy(ctx.token, ctx.merchantId, body);
    } else {
      try {
        await createReturnPolicy(ctx.token, ctx.merchantId, body);
        await deleteReturnPolicy(ctx.token, replaceName);
      } catch (err) {
        if (!(err instanceof Error) || !/label|already exists|duplicate|ALREADY_EXISTS/i.test(err.message)) throw err;
        const old = (await listReturnPolicies(ctx.token, ctx.merchantId)).find((p) => p.name === replaceName);
        await deleteReturnPolicy(ctx.token, replaceName);
        try {
          await createReturnPolicy(ctx.token, ctx.merchantId, body);
        } catch (createErr) {
          if (old) await createReturnPolicy(ctx.token, ctx.merchantId, forCreate(old)).catch(() => {});
          throw createErr;
        }
      }
    }
  } catch (err) {
    await afterWrite(projectId);
    return explain(err, ctx.project);
  }
  await afterWrite(projectId);
  return ok(undefined);
}

export async function removeReturnPolicy(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(name, ctx.merchantId, "onlineReturnPolicies")) return fail("That return policy isn't part of this project's Merchant Center account.");
  try {
    await deleteReturnPolicy(ctx.token, name);
  } catch (err) {
    return explain(err, ctx.project);
  }
  await afterWrite(projectId);
  return ok(undefined);
}

// ---- account settings ----

const RIGHTS: AccessRight[] = ["STANDARD", "READ_ONLY", "ADMIN", "PERFORMANCE_REPORTING", "API_DEVELOPER"];
const cleanRights = (r: AccessRight[]) => [...new Set(r.filter((x) => RIGHTS.includes(x)))];
const trimOrUndef = (s?: string) => s?.trim() || undefined;

export type BusinessInfoInput = {
  name: string;
  /** The name as loaded, so the account is only renamed when it changed */
  previousName: string;
  address: { addressLines: string[]; locality: string; administrativeArea: string; postalCode: string; regionCode: string };
  customerService: { email: string; uri: string; phone: string };
};

/** Updates the business name (the account's name), address and customer service. (The business phone is verified in Merchant Center itself.) */
export async function saveBusinessInfo(projectId: string, input: BusinessInfoInput): Promise<ActionResult<BusinessInfoDoc>> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const cs = input.customerService;
  if (cs.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cs.email.trim())) return fail("Enter a valid customer service email.");
  if (cs.uri && !/^https?:\/\//i.test(cs.uri.trim())) return fail("The customer service URL must start with http:// or https://.");
  if (cs.phone && !/^\+[1-9]\d{6,14}$/.test(cs.phone.replace(/[\s-]/g, ""))) return fail("Write the phone in international format, e.g. +924211234567.");
  const a = input.address;
  if (a.regionCode && !/^[A-Z]{2}$/.test(a.regionCode)) return fail("The country must be a 2-letter code, e.g. PK.");
  const hasAddress = [a.locality, a.administrativeArea, a.postalCode, a.regionCode, ...a.addressLines].some((x) => x.trim());
  if (!input.name.trim()) return fail("Enter the business name.");
  const info: BusinessInfoDoc = {
    address: hasAddress
      ? {
          addressLines: a.addressLines.map((l) => l.trim()).filter(Boolean),
          locality: trimOrUndef(a.locality),
          administrativeArea: trimOrUndef(a.administrativeArea),
          postalCode: trimOrUndef(a.postalCode),
          regionCode: trimOrUndef(a.regionCode),
        }
      : undefined,
    customerService: {
      email: trimOrUndef(cs.email),
      uri: trimOrUndef(cs.uri),
      phone: cs.phone.trim() ? { e164Number: cs.phone.replace(/[\s-]/g, "") } : undefined,
    },
  };
  try {
    if (input.name.trim() !== input.previousName) await renameAccount(ctx.token, ctx.merchantId, input.name.trim());
    // Fields left out of the body but named in the mask are cleared
    const saved = await updateBusinessInfo(ctx.token, ctx.merchantId, info, "address,customer_service");
    await afterWrite(projectId);
    return ok(saved);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Changes the store's homepage URL. Changing it drops the claim, so it's claimed again afterwards if it was claimed. */
export async function saveHomepage(projectId: string, uri: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(uri.trim())) return fail("Enter the store's full URL, e.g. https://example.com.");
  try {
    await updateHomepage(ctx.token, ctx.merchantId, uri.trim());
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Claims (or releases) the homepage. `overwrite` takes the claim from another account. */
export async function setHomepageClaim(projectId: string, claim: boolean, overwrite = false): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  try {
    if (claim) await claimHomepage(ctx.token, ctx.merchantId, overwrite);
    else await unclaimHomepage(ctx.token, ctx.merchantId);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Turns a program (free listings, Shopping ads, …) on or off. */
export async function toggleProgram(projectId: string, programName: string, enable: boolean): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(programName, ctx.merchantId, "programs")) return fail("That program isn't in this account.");
  try {
    await setProgram(ctx.token, programName, enable);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Invites someone to the Merchant Center account. */
export async function addMerchantUser(projectId: string, email: string, rights: AccessRight[]): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const e = email.trim().toLowerCase();
  if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(e)) return fail("Enter a valid email address.");
  const r = cleanRights(rights);
  if (!r.length) return fail("Choose at least one access right.");
  try {
    await createUser(ctx.token, ctx.merchantId, e, r);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

export async function changeMerchantUser(projectId: string, userName: string, rights: AccessRight[]): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(userName, ctx.merchantId, "users")) return fail("That person isn't in this account.");
  const r = cleanRights(rights);
  if (!r.length) return fail("Choose at least one access right.");
  try {
    await updateUser(ctx.token, userName, r);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

export async function removeMerchantUser(projectId: string, userName: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(userName, ctx.merchantId, "users")) return fail("That person isn't in this account.");
  try {
    await deleteUser(ctx.token, userName);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- products ----

// The data sources the app creates in the store's account, found again by name (a "use server" file exports only actions)
const EDITS_SOURCE = "Seo Engine edits";
const PRODUCTS_SOURCE = "Seo Engine products";

const productOf = (name: string, merchantId: string) => new RegExp(`^accounts/${merchantId}/products/[^/\\s]+$`).test(name);

/** One product with every attribute and its status, for the product panel. Reading needs only project access. */
export async function getProductDetail(projectId: string, name: string): Promise<ActionResult<ProductDoc & { ours: boolean }>> {
  const { project } = await requireProject(projectId);
  if (!project.merchantId || !productOf(name, project.merchantId)) return fail("That product isn't in this account.");
  try {
    const token = await getGoogleAccessToken(project);
    const [p, sources] = await Promise.all([getProduct(token, name), listDataSources(token, project.merchantId)]);
    const mine = sources.find((d) => d.displayName === PRODUCTS_SOURCE && d.input === "API" && d.primaryProductDataSource);
    return ok({ ...p, ours: Boolean(mine && p.dataSource === mine.name) });
  } catch (err) {
    return explain(err, project);
  }
}

/** Finds the app's data source by name, or creates it. */
async function ensureSource(token: string, merchantId: string, displayName: string, kind: "supplemental" | "primary"): Promise<DataSourceDoc> {
  const found = (await listDataSources(token, merchantId)).find(
    (d) => d.displayName === displayName && d.input === "API" && (kind === "primary" ? d.primaryProductDataSource : d.supplementalProductDataSource),
  );
  if (found) return found;
  return createDataSource(token, merchantId, kind === "primary" ? { displayName, primaryProductDataSource: {} } : { displayName, supplementalProductDataSource: {} });
}

/** Puts the edits source first in a primary source's default rule, so its values win over the feed's. */
async function linkFirst(token: string, primaryName: string, editsName: string) {
  const primary = await getDataSource(token, primaryName);
  const rule = primary.primaryProductDataSource?.defaultRule?.takeFromDataSources ?? [{ self: true }];
  if (rule[0]?.supplementalDataSourceName === editsName) return;
  const rest = rule.filter((r) => r.supplementalDataSourceName !== editsName);
  await patchDataSource(
    token,
    primaryName,
    { primaryProductDataSource: { defaultRule: { takeFromDataSources: [{ supplementalDataSourceName: editsName }, ...(rest.length ? rest : [{ self: true }])] } } },
    "primaryProductDataSource.defaultRule",
  );
}

/**
 * Saves changed attributes over a product from any source. Feeds can't be edited through the API, so
 * the values go into the app's supplemental source, which overrides only those attributes.
 */
export async function saveProductEdits(projectId: string, name: string, before: ProductForm, after: ProductForm): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!productOf(name, ctx.merchantId)) return fail("That product isn't in this account.");
  const problems = checkProduct(after, { isNew: false });
  if (problems.length) return fail(problems.join(" "));
  const fields = changedFields(before, after);
  if (!fields.length) return fail("Nothing changed.");
  const attrs: Record<string, unknown> = {};
  for (const f of fields) {
    const v = attributeValue(after, f);
    // A cleared field falls back to the feed's value: leave it out, it's named in the mask
    if (v !== undefined) attrs[f] = v;
  }
  try {
    const missing = await overrideAttributes(ctx.token, ctx.merchantId, name, attrs, fields);
    if (missing) return fail(missing);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/**
 * Writes attributes over a product through the app's supplemental source; `mask` names every attribute
 * touched, so one named but absent from `attrs` falls back to the feed. Returns a message if the product can't be edited.
 */
async function overrideAttributes(token: string, merchantId: string, name: string, attrs: Record<string, unknown>, mask: string[]): Promise<string | null> {
  const p = await getProduct(token, name);
  if (!p.dataSource || !p.offerId || !p.contentLanguage || !p.feedLabel) return "Google didn't return this product's source, so it can't be edited here.";
  const edits = await ensureSource(token, merchantId, EDITS_SOURCE, "supplemental");
  await linkFirst(token, p.dataSource, edits.name!);
  const input = { offerId: p.offerId, contentLanguage: p.contentLanguage, feedLabel: p.feedLabel, productAttributes: attrs };
  const inputName = `accounts/${merchantId}/productInputs/${inputSegment(p.contentLanguage, p.feedLabel, p.offerId)}`;
  try {
    // Patch keeps earlier edits to other attributes
    await patchProductInput(token, inputName, edits.name!, input, mask);
  } catch (err) {
    if (!(err instanceof GoogleApiError && err.status === 404)) throw err;
    await insertProductInput(token, merchantId, edits.name!, input);
  }
  return null;
}

/** Sets a product's video links (an empty list falls back to the feed's). */
export async function saveProductVideos(projectId: string, name: string, links: string[]): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!productOf(name, ctx.merchantId)) return fail("That product isn't in this account.");
  const clean = [...new Set(links.map((l) => l.trim()).filter(Boolean))];
  const bad = clean.find((l) => !/^https?:\/\/[^\s]+$/i.test(l));
  if (bad) return fail(`"${bad}" isn't a web link. Each video must be a full http:// or https:// URL.`);
  if (clean.length > 10) return fail("A product can have at most 10 videos.");
  try {
    const missing = await overrideAttributes(ctx.token, ctx.merchantId, name, clean.length ? { videoLinks: clean } : {}, ["videoLinks"]);
    if (missing) return fail(missing);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Drops every edit made here, so the product shows its feed's values again. */
export async function revertProductEdits(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!productOf(name, ctx.merchantId)) return fail("That product isn't in this account.");
  try {
    const p = await getProduct(ctx.token, name);
    const edits = (await listDataSources(ctx.token, ctx.merchantId)).find((d) => d.displayName === EDITS_SOURCE && d.supplementalProductDataSource);
    if (!edits || !p.offerId || !p.contentLanguage || !p.feedLabel) return fail("This product has no edits from Seo Engine.");
    try {
      await deleteProductInput(ctx.token, `accounts/${ctx.merchantId}/productInputs/${inputSegment(p.contentLanguage, p.feedLabel, p.offerId)}`, edits.name!);
    } catch (err) {
      if (err instanceof GoogleApiError && err.status === 404) return fail("This product has no edits from Seo Engine.");
      throw err;
    }
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

export type NewProduct = { offerId: string; contentLanguage: string; feedLabel: string; form: ProductForm };

/** Adds a product to the app's own API source (created on first use). */
export async function addProduct(projectId: string, np: NewProduct): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const offerId = np.offerId;
  const lang = np.contentLanguage.trim().toLowerCase();
  const label = np.feedLabel.trim().toUpperCase();
  if (!validOfferId(offerId)) return fail("The product ID must be 1–50 characters, without spaces at the ends.");
  if (!/^[a-z]{2}$/.test(lang)) return fail("The language must be a 2-letter code, e.g. en.");
  if (!/^[A-Z0-9-]{1,20}$/.test(label)) return fail("The feed label must be up to 20 letters, numbers or dashes, e.g. PK.");
  const problems = checkProduct(np.form, { isNew: true });
  if (problems.length) return fail(problems.join(" "));
  const attrs: Record<string, unknown> = {};
  for (const f of changedFields(toForm(undefined), np.form)) {
    const v = attributeValue(np.form, f);
    if (v !== undefined) attrs[f] = v;
  }
  try {
    const src = await ensureSource(ctx.token, ctx.merchantId, PRODUCTS_SOURCE, "primary");
    await insertProductInput(ctx.token, ctx.merchantId, src.name!, { offerId, contentLanguage: lang, feedLabel: label, productAttributes: attrs });
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Deletes a product the app added. Products from feeds are removed from their feed instead. */
export async function deleteProduct(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!productOf(name, ctx.merchantId)) return fail("That product isn't in this account.");
  try {
    const p = await getProduct(ctx.token, name);
    const mine = (await listDataSources(ctx.token, ctx.merchantId)).find((d) => d.displayName === PRODUCTS_SOURCE && d.input === "API" && d.primaryProductDataSource);
    if (!mine || p.dataSource !== mine.name || !p.offerId || !p.contentLanguage || !p.feedLabel) return fail("Only products added in Seo Engine can be deleted here. Remove others from their feed.");
    await deleteProductInput(ctx.token, `accounts/${ctx.merchantId}/productInputs/${inputSegment(p.contentLanguage, p.feedLabel, p.offerId)}`, mine.name!);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- feeds (data sources) ----

/** Asks Google to fetch a scheduled file feed now, instead of waiting for its schedule. */
export async function fetchFeedNow(projectId: string, dsName: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(dsName, ctx.merchantId, "dataSources")) return fail("That feed isn't in this account.");
  try {
    await fetchDataSourceNow(ctx.token, dsName);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Pauses or resumes a scheduled fetch. */
export async function setFeedSchedule(projectId: string, dsName: string, enabled: boolean): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(dsName, ctx.merchantId, "dataSources")) return fail("That feed isn't in this account.");
  try {
    const ds = await getDataSource(ctx.token, dsName);
    if (ds.fileInput?.fileInputType !== "FETCH") return fail("Only scheduled URL feeds can be paused.");
    // Only the flag: sending the whole fetch settings would clear the stored password, which Google doesn't return
    await patchDataSource(ctx.token, dsName, { fileInput: { fetchSettings: { enabled } } }, "fileInput.fetchSettings.enabled");
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

export type NewFeed = {
  displayName: string;
  fetchUri: string;
  fileName: string;
  contentLanguage: string;
  feedLabel: string;
  countries: string[];
  frequency: "FREQUENCY_DAILY" | "FREQUENCY_WEEKLY" | "FREQUENCY_MONTHLY";
  hour: number;
  timeZone: string;
  dayOfWeek?: string;
  dayOfMonth?: number;
  username?: string;
  password?: string;
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/** Adds a primary product feed that Google fetches from a URL on a schedule. */
export async function addScheduledFeed(projectId: string, f: NewFeed): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const lang = f.contentLanguage.trim().toLowerCase();
  const label = f.feedLabel.trim().toUpperCase();
  const countries = [...new Set(f.countries.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (!f.displayName.trim()) return fail("Name the feed.");
  if (!/^(https?|sftp):\/\/[^\s]+$/i.test(f.fetchUri.trim())) return fail("The file URL must start with http://, https:// or sftp://.");
  if (!/^[a-z]{2}$/.test(lang)) return fail("The language must be a 2-letter code, e.g. en.");
  if (!/^[A-Z0-9-]{1,20}$/.test(label)) return fail("The feed label must be up to 20 letters, numbers or dashes, e.g. PK.");
  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) return fail("Countries must be 2-letter codes, e.g. PK.");
  if (!Number.isInteger(f.hour) || f.hour < 0 || f.hour > 23) return fail("The hour must be 0–23.");
  if (!["FREQUENCY_DAILY", "FREQUENCY_WEEKLY", "FREQUENCY_MONTHLY"].includes(f.frequency)) return fail("Choose how often to fetch.");
  if (f.frequency === "FREQUENCY_WEEKLY" && !DAYS.includes(f.dayOfWeek ?? "")) return fail("Choose the day of the week.");
  if (f.frequency === "FREQUENCY_MONTHLY" && !(Number.isInteger(f.dayOfMonth) && f.dayOfMonth! >= 1 && f.dayOfMonth! <= 31)) return fail("The day of the month must be 1–31.");
  try {
    await createDataSource(ctx.token, ctx.merchantId, {
      displayName: f.displayName.trim(),
      primaryProductDataSource: { contentLanguage: lang, feedLabel: label, countries: countries.length ? countries : undefined },
      fileInput: {
        fileName: f.fileName.trim() || undefined,
        fetchSettings: {
          enabled: true,
          fetchUri: f.fetchUri.trim(),
          frequency: f.frequency,
          timeOfDay: { hours: f.hour },
          timeZone: f.timeZone.trim() || undefined,
          dayOfWeek: f.frequency === "FREQUENCY_WEEKLY" ? f.dayOfWeek : undefined,
          dayOfMonth: f.frequency === "FREQUENCY_MONTHLY" ? f.dayOfMonth : undefined,
          username: f.username?.trim() || undefined,
          password: f.password || undefined,
        },
      },
    });
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Deletes a data source, and with a primary one every product in it. */
export async function removeFeed(projectId: string, dsName: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(dsName, ctx.merchantId, "dataSources")) return fail("That feed isn't in this account.");
  try {
    await deleteDataSource(ctx.token, dsName);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- promotions ----

const PROMOTIONS_SOURCE = "Seo Engine promotions";

/**
 * Creates (or, with the same ID, country and language, replaces) a promotion. Promotions go through a
 * promotion data source per country and language, which the app creates on first use.
 */
export async function savePromotion(projectId: string, form: PromotionForm): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const problems = checkPromotion(form);
  if (problems.length) return fail(problems.join(" "));
  try {
    const name = `${PROMOTIONS_SOURCE} ${form.targetCountry}/${form.contentLanguage}`;
    const sources = await listDataSources(ctx.token, ctx.merchantId);
    let src = sources.find(
      (d) => d.input === "API" && d.promotionDataSource?.targetCountry === form.targetCountry && d.promotionDataSource?.contentLanguage === form.contentLanguage && d.displayName === name,
    );
    src ??= await createDataSource(ctx.token, ctx.merchantId, { displayName: name, promotionDataSource: { targetCountry: form.targetCountry, contentLanguage: form.contentLanguage } });
    await insertPromotion(ctx.token, ctx.merchantId, src.name!, toPromotion(form));
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Google can't delete promotions; ending one sends it again with an end time of now. */
export async function endPromotion(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!new RegExp(`^accounts/${ctx.merchantId}/promotions/[^/\\s]+$`).test(name)) return fail("That promotion isn't in this account.");
  try {
    const p = (await listPromotions(ctx.token, ctx.merchantId)).find((x) => x.name === name);
    if (!p?.dataSource || !p.attributes) return fail("That promotion wasn't found.");
    if (!(await listDataSources(ctx.token, ctx.merchantId)).some((d) => d.name === p.dataSource && d.input === "API")) {
      return fail("This promotion comes from a file or Merchant Center itself; end it there.");
    }
    const now = new Date();
    const start = p.attributes.promotionEffectiveTimePeriod?.startTime;
    const period = { startTime: start && new Date(start) < now ? start : new Date(now.getTime() - 3_600_000).toISOString(), endTime: now.toISOString() };
    // Send back only what was submitted: no name, status or source (output only)
    const promo = { ...p, name: undefined, promotionStatus: undefined, dataSource: undefined, attributes: { ...p.attributes, promotionEffectiveTimePeriod: period } };
    await insertPromotion(ctx.token, ctx.merchantId, p.dataSource, promo);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- reviews ----

/** Removes a product review from Merchant Center (e.g. spam). It's gone from Google, not from where it was written. */
export async function removeProductReview(projectId: string, reviewName: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(reviewName, ctx.merchantId, "productReviews")) return fail("That review isn't in this account.");
  try {
    await deleteProductReview(ctx.token, reviewName);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- automatic improvements ----

export type ImprovementSettings = { price: boolean; availability: boolean; strictAvailability: boolean; condition: boolean; images: boolean; shipping: boolean };

/** Lets Google fix prices, availability, condition, images and shipping from the store's website. */
export async function saveAutomaticImprovements(projectId: string, s: ImprovementSettings): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  try {
    await updateAutomaticImprovements(
      ctx.token,
      ctx.merchantId,
      {
        itemUpdates: {
          accountItemUpdatesSettings: {
            allowPriceUpdates: s.price,
            allowAvailabilityUpdates: s.availability,
            // Strict availability only applies on top of availability updates
            allowStrictAvailabilityUpdates: s.availability && s.strictAvailability,
            allowConditionUpdates: s.condition,
          },
        },
        imageImprovements: { accountImageImprovementsSettings: { allowAutomaticImageImprovements: s.images } },
        shippingImprovements: { allowShippingImprovements: s.shipping },
      },
      "item_updates.account_level_settings,image_improvements.account_level_settings,shipping_improvements.allow_shipping_improvements",
    );
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- conversion sources ----

const MODELS: AttributionModel[] = [
  "CROSS_CHANNEL_LAST_CLICK",
  "ADS_PREFERRED_LAST_CLICK",
  "CROSS_CHANNEL_DATA_DRIVEN",
  "CROSS_CHANNEL_FIRST_CLICK",
  "CROSS_CHANNEL_LINEAR",
  "CROSS_CHANNEL_POSITION_BASED",
  "CROSS_CHANNEL_TIME_DECAY",
];
const sourceOf = (name: string, merchantId: string) => new RegExp(`^accounts/${merchantId}/conversionSources/[A-Za-z0-9_-]+$`).test(name);

export type NewConversionSource =
  | { kind: "ga"; propertyId: string }
  | { kind: "tag"; displayName: string; currencyCode: string; attributionModel: AttributionModel; lookbackDays: number };

function checkAttribution(model: AttributionModel, days: number) {
  if (!MODELS.includes(model)) return "Choose an attribution model.";
  if (!Number.isInteger(days) || days < 1 || days > 90) return "The lookback window must be 1 to 90 days.";
  return null;
}

/** Links a Google Analytics property, or adds a Merchant Center tag conversion source. */
export async function addConversionSource(projectId: string, src: NewConversionSource): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  let doc;
  if (src.kind === "ga") {
    const id = src.propertyId.trim().replace(/^properties\//, "");
    if (!/^\d+$/.test(id)) return fail("The Google Analytics property ID is a number, e.g. 123456789.");
    doc = { googleAnalyticsLink: { propertyId: id } };
  } else {
    if (!src.displayName.trim()) return fail("Name the conversion source.");
    if (!/^[A-Z]{3}$/.test(src.currencyCode)) return fail("The currency must be a 3-letter code, e.g. PKR.");
    const bad = checkAttribution(src.attributionModel, src.lookbackDays);
    if (bad) return fail(bad);
    doc = {
      merchantCenterDestination: {
        displayName: src.displayName.trim(),
        currencyCode: src.currencyCode,
        attributionSettings: { attributionModel: src.attributionModel, attributionLookbackWindowDays: src.lookbackDays },
      },
    };
  }
  try {
    await createConversionSource(ctx.token, ctx.merchantId, doc);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Changes the attribution of a Merchant Center tag source (Analytics links take theirs from Analytics). */
export async function updateConversionAttribution(projectId: string, name: string, model: AttributionModel, lookbackDays: number): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!sourceOf(name, ctx.merchantId)) return fail("That conversion source isn't in this account.");
  const bad = checkAttribution(model, lookbackDays);
  if (bad) return fail(bad);
  try {
    await patchConversionSource(
      ctx.token,
      name,
      { merchantCenterDestination: { attributionSettings: { attributionModel: model, attributionLookbackWindowDays: lookbackDays } } },
      "merchant_center_destination.attribution_settings.attribution_model,merchant_center_destination.attribution_settings.attribution_lookback_window_days",
    );
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Archives a tag source (restorable in Merchant Center for 30 days) or removes an Analytics link. */
export async function removeConversionSource(projectId: string, name: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!sourceOf(name, ctx.merchantId)) return fail("That conversion source isn't in this account.");
  try {
    await deleteConversionSource(ctx.token, name);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- apps and services ----

/** Asks to link the Business Profile managed by this email; its owner approves it in Business Profile. */
export async function linkBusinessProfile(projectId: string, email: string): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return fail("Enter the email address that manages the Business Profile.");
  try {
    await linkGbpAccount(ctx.token, ctx.merchantId, e);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

/** Approves or rejects a link another service (Google Ads, an agency, …) asked for. */
export async function decideServiceLink(projectId: string, name: string, approve: boolean): Promise<ActionResult> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!ownedBy(name, ctx.merchantId, "services")) return fail("That service isn't linked to this account.");
  try {
    await decideAccountService(ctx.token, name, approve);
    await afterWrite(projectId);
    return ok(undefined);
  } catch (err) {
    return explain(err, ctx.project);
  }
}

// ---- Product Studio ----

// Product Studio only generates; nothing changes in Merchant Center until a suggestion is applied.
// It still uses the write check, since generating spends the account's quota.

const studioProblem = async (err: unknown, project: { id: string; userId: string; merchantId: string | null }) => {
  if (err instanceof GoogleApiError && (err.status === 403 || err.status === 404) && /productstudio|not (been )?enabled|allowlist|alpha|not allowed|permission/i.test(err.message)) {
    return fail("Product Studio's API is a Google preview: Google has to enable it for this app's Google Cloud project before it works. Google said: " + err.message);
  }
  return explain(err, project);
};

export type StudioText = { title: { text: string; summary: string | null } | null; description: { text: string; summary: string | null } | null };

/** Suggests a title and description for a product from its attributes. */
export async function studioSuggestText(projectId: string, productName: string, tone: string, language: string): Promise<ActionResult<StudioText>> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!productOf(productName, ctx.merchantId)) return fail("That product isn't in this account.");
  if (language && !/^[a-z]{2}$/.test(language)) return fail("The language must be a 2-letter code, e.g. en.");
  try {
    const p = await getProduct(ctx.token, productName);
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.productAttributes ?? {})) {
      if (typeof v === "string" && v.trim()) attrs[k] = v;
      else if (Array.isArray(v) && v.every((x) => typeof x === "string") && v.length) attrs[k] = v.join(", ");
    }
    if (!attrs.title && !attrs.description) return fail("This product has no title or description to start from.");
    const image = typeof p.productAttributes?.imageLink === "string" && /^https:\/\//.test(p.productAttributes.imageLink) ? p.productAttributes.imageLink : undefined;
    const r = await suggestProductText(ctx.token, ctx.merchantId, attrs, image, { tone: tone || undefined, targetLanguage: language || undefined });
    const pick = (x?: { text?: string; changeSummary?: string }) => (x?.text ? { text: x.text, summary: x.changeSummary ?? null } : null);
    return ok({ title: pick(r.title), description: pick(r.description) });
  } catch (err) {
    return studioProblem(err, ctx.project);
  }
}

/** One image tool on a product image; returns a link to (or the data of) the new image. Nothing is saved. */
export async function studioEditImage(
  projectId: string,
  imageUri: string,
  tool: "remove" | "background" | "upscale",
  backgroundDescription?: string,
): Promise<ActionResult<{ src: string }>> {
  const ctx = await writeContext(projectId);
  if ("error" in ctx) return ctx.error!;
  if (!/^https:\/\/[^\s]+$/i.test(imageUri)) return fail("The image must be an https:// link.");
  if (!["remove", "background", "upscale"].includes(tool)) return fail("Choose an image tool.");
  if (tool === "background" && !backgroundDescription?.trim()) return fail("Describe the background you want.");
  try {
    const img = await editProductImage(ctx.token, ctx.merchantId, imageUri, tool, tool === "background" ? { backgroundDescription: backgroundDescription!.trim() } : undefined);
    if (img.uri && /^https:\/\//.test(img.uri)) return ok({ src: img.uri });
    if (img.imageBytes) return ok({ src: `data:image/png;base64,${img.imageBytes}` });
    return fail("Google didn't return an image.");
  } catch (err) {
    return studioProblem(err, ctx.project);
  }
}
