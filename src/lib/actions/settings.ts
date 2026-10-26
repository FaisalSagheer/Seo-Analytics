"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { encrypt, generateApiKey } from "@/lib/crypto";
import { requireUser } from "@/lib/session";
import { createDataForSeo } from "@/lib/providers/dataforseo";
import { getBingApiKey, getGoogleAccessToken } from "@/lib/providers";
import { listGa4Properties, listGscSites } from "@/lib/providers/google";
import { verifySerperKey } from "@/lib/providers/serper";
import { listBingSites } from "@/lib/providers/bing";
import {
  bingCredentialSchema,
  type BingCredentialInput,
  apiKeySchema,
  providerCredentialSchema,
  serperCredentialSchema,
  type ApiKeyInput,
  type ProviderCredentialInput,
  type SerperCredentialInput,
} from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

export async function saveDataForSeo(input: ProviderCredentialInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = providerCredentialSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { login, password } = parsed.data;

  // Verify before storing: a cheap backlinks summary call on a known domain
  try {
    await createDataForSeo(login, password).backlinkSummary({ domain: "dataforseo.com" });
  } catch (err) {
    return fail(`Could not verify credentials: ${err instanceof Error ? err.message : String(err)}`);
  }

  const secretEncrypted = encrypt(password);
  await db.providerCredential.upsert({
    where: { userId_provider: { userId: user.id, provider: "DATAFORSEO" } },
    create: { userId: user.id, provider: "DATAFORSEO", login, secretEncrypted },
    update: { login, secretEncrypted },
  });
  revalidatePath("/settings");
  return ok(undefined);
}

export async function removeDataForSeo(): Promise<ActionResult> {
  const user = await requireUser();
  await db.providerCredential.deleteMany({ where: { userId: user.id, provider: "DATAFORSEO" } });
  revalidatePath("/settings");
  return ok(undefined);
}

export async function saveSerper(input: SerperCredentialInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = serperCredentialSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { apiKey, rankDepth } = parsed.data;
  const where = { userId_provider: { userId: user.id, provider: "SERPER" as const } };

  if (!apiKey) {
    // Depth-only change; needs an existing key
    const { count } = await db.providerCredential.updateMany({ where: { userId: user.id, provider: "SERPER" }, data: { rankDepth } });
    if (count === 0) return fail("Enter your Serper API key.");
  } else {
    try {
      await verifySerperKey(apiKey);
    } catch (err) {
      return fail(`Could not verify the key: ${err instanceof Error ? err.message : String(err)}`);
    }
    const secretEncrypted = encrypt(apiKey);
    await db.providerCredential.upsert({
      where,
      create: { userId: user.id, provider: "SERPER", login: "", secretEncrypted, rankDepth },
      update: { secretEncrypted, rankDepth },
    });
  }
  revalidatePath("/settings");
  return ok(undefined);
}

export async function removeSerper(): Promise<ActionResult> {
  const user = await requireUser();
  await db.providerCredential.deleteMany({ where: { userId: user.id, provider: "SERPER" } });
  revalidatePath("/settings");
  return ok(undefined);
}

export async function saveBing(input: BingCredentialInput): Promise<ActionResult<{ sites: number }>> {
  const user = await requireUser();
  const parsed = bingCredentialSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  let sites: string[];
  try {
    // Free call; also tells the user how many verified sites the key can see
    sites = await listBingSites(parsed.data.apiKey);
  } catch (err) {
    return fail(`Could not verify the key: ${err instanceof Error ? err.message : String(err)}`);
  }
  const secretEncrypted = encrypt(parsed.data.apiKey);
  await db.providerCredential.upsert({
    where: { userId_provider: { userId: user.id, provider: "BING" } },
    create: { userId: user.id, provider: "BING", login: "", secretEncrypted },
    update: { secretEncrypted },
  });
  revalidatePath("/settings");
  return ok({ sites: sites.length });
}

export async function removeBing(): Promise<ActionResult> {
  const user = await requireUser();
  await db.providerCredential.deleteMany({ where: { userId: user.id, provider: "BING" } });
  revalidatePath("/settings");
  return ok(undefined);
}

export async function listBingProperties(): Promise<ActionResult<string[]>> {
  const user = await requireUser();
  const apiKey = await getBingApiKey(user.id);
  if (!apiKey) return fail("Connect Bing Webmaster Tools in Settings → Providers first.");
  try {
    return ok(await listBingSites(apiKey));
  } catch (err) {
    return fail(err);
  }
}

export async function listGoogleProperties(): Promise<
  ActionResult<{ sites: string[]; properties: { id: string; name: string }[] }>
> {
  const user = await requireUser();
  try {
    const token = await getGoogleAccessToken(user.id);
    const [sites, properties] = await Promise.all([
      listGscSites(token),
      // GA4 Admin API may be disabled on the Cloud project; don't lose GSC over it
      listGa4Properties(token).catch(() => []),
    ]);
    return ok({ sites, properties });
  } catch (err) {
    return fail(err);
  }
}

export async function createApiKey(input: ApiKeyInput): Promise<ActionResult<{ key: string }>> {
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
