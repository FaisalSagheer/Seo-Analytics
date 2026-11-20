"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/crypto";
import { denied, requireProject, requireUser } from "@/lib/session";
import { getGoogleAccessToken } from "@/lib/providers";
import { propertyChoiceDenied } from "@/lib/google-access";
import { listGa4Properties, listGscSites, listMerchantAccounts, registerMerchantGcp } from "@/lib/providers/google";
import { merchantProblem } from "@/lib/shopping";
import { apiKeySchema, type ApiKeyInput } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

// The property picker lists what this project's Google access can see: its own service account, else the owner's connection
export async function listGoogleProperties(projectId: string): Promise<
  ActionResult<{ sites: string[]; properties: { id: string; name: string }[]; merchants: { id: string; name: string }[] }>
> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  const notYours = await propertyChoiceDenied(project);
  if (notYours) return notYours;
  try {
    const token = await getGoogleAccessToken(project);
    const [sites, properties, merchants] = await Promise.all([
      listGscSites(token),
      // GA4 Admin API may be disabled on the Cloud project; don't lose GSC over it
      listGa4Properties(token).catch(() => []),
      // Likewise Merchant Center: optional, and older connections don't carry its scope
      listMerchantAccounts(token).catch(() => []),
    ]);
    return ok({ sites, properties, merchants });
  } catch (err) {
    return fail(err);
  }
}

export async function createApiKey(input: ApiKeyInput): Promise<ActionResult<{ key: string }>> {
  const blocked = await denied("apikeys.manage");
  if (blocked) return blocked;
  const user = await requireUser();
  const parsed = apiKeySchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { raw, prefix, hashed } = generateApiKey();
  await db.apiKey.create({ data: { userId: user.id, name: parsed.data.name, prefix, hashedKey: hashed } });
  revalidatePath("/settings");
  // Shown once; only the hash is stored
  return ok({ key: raw });
}

export async function revokeApiKey(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.apiKey.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/settings");
  return ok(undefined);
}

/**
 * Registers this app's Google Cloud project with the project's Merchant Center account, which
 * Google asks for once before the Merchant API answers. Needs Admin access to that account.
 */
export async function registerMerchantCenter(projectId: string): Promise<ActionResult> {
  const blocked = await denied("providers.manage");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  if (!project.merchantId) return fail("Choose a Merchant Center account in Project settings first.");
  try {
    await registerMerchantGcp(await getGoogleAccessToken(project), project.merchantId);
  } catch (err) {
    return fail((await merchantProblem(err, project)).message);
  }
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok(undefined);
}
