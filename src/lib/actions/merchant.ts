"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denied, requireProject } from "@/lib/session";
import { propertyChoiceDenied } from "@/lib/google-access";
import { getGoogleAccessToken } from "@/lib/providers";
import {
  GoogleApiError,
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
const ownedBy = (name: string, merchantId: string, kind: "regions" | "onlineReturnPolicies") =>
  new RegExp(`^accounts/${merchantId}/${kind}/[A-Za-z0-9_-]+$`).test(name);

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
