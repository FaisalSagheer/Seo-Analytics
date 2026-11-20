"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denied, requireProject } from "@/lib/session";
import { propertyChoiceDenied } from "@/lib/google-access";
import { getGoogleAccessToken } from "@/lib/providers";
import {
  GoogleApiError,
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
const ownedBy = (name: string, merchantId: string, kind: "regions" | "onlineReturnPolicies" | "programs" | "users") =>
  new RegExp(`^accounts/${merchantId}/${kind}/${kind === "users" ? "[^/\\s]+@[^/\\s]+" : "[A-Za-z0-9_-]+"}$`).test(name);

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
