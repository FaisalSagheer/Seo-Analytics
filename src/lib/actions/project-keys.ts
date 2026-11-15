"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { denied, requireProject } from "@/lib/session";
import { createDataForSeo } from "@/lib/providers/dataforseo";
import { listBingSites } from "@/lib/providers/bing";
import { verifySerperKey } from "@/lib/providers/serper";
import { bingCredentialSchema, providerCredentialSchema, serperCredentialSchema } from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/**
 * Provider keys that belong to one project, e.g. the client's own. Anyone whose
 * role can connect providers (admins always) may add or replace them.
 */

const withProject = { projectId: z.string().min(1) };
const projectDataForSeoSchema = providerCredentialSchema.extend(withProject);
const projectSerperSchema = serperCredentialSchema.extend(withProject);
const projectBingSchema = bingCredentialSchema.extend(withProject);
export type ProjectDataForSeoInput = z.input<typeof projectDataForSeoSchema>;
export type ProjectSerperInput = z.input<typeof projectSerperSchema>;
export type ProjectBingInput = z.input<typeof projectBingSchema>;

type Guard = { allowed: true } | { allowed: false; error: { ok: false; error: string } };

async function guard(projectId: string): Promise<Guard> {
  const blocked = await denied("providers.manage");
  if (blocked) return { allowed: false, error: blocked };
  const { project } = await requireProject(projectId);
  if (project.isDemo) return { allowed: false, error: fail("Demo projects use generated data and don't take provider keys.") };
  return { allowed: true };
}

function done(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(undefined);
}

export async function saveProjectDataForSeo(input: ProjectDataForSeoInput): Promise<ActionResult> {
  const parsed = projectDataForSeoSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const g = await guard(parsed.data.projectId);
  if (!g.allowed) return g.error;
  const { projectId, login, password } = parsed.data;
  try {
    await createDataForSeo(login, password).backlinkSummary({ domain: "dataforseo.com" });
  } catch (err) {
    return fail(`Could not verify credentials: ${err instanceof Error ? err.message : String(err)}`);
  }
  const secretEncrypted = encrypt(password);
  await db.projectCredential.upsert({
    where: { projectId_provider: { projectId, provider: "DATAFORSEO" } },
    create: { projectId, provider: "DATAFORSEO", login, secretEncrypted },
    update: { login, secretEncrypted },
  });
  return done(projectId);
}

export async function saveProjectSerper(input: ProjectSerperInput): Promise<ActionResult> {
  const parsed = projectSerperSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const g = await guard(parsed.data.projectId);
  if (!g.allowed) return g.error;
  const { projectId, apiKey, rankDepth } = parsed.data;
  if (!apiKey) {
    // Depth-only change; needs a key saved for this project
    const { count } = await db.projectCredential.updateMany({ where: { projectId, provider: "SERPER" }, data: { rankDepth } });
    if (count === 0) return fail("Enter the Serper API key.");
    return done(projectId);
  }
  try {
    await verifySerperKey(apiKey);
  } catch (err) {
    return fail(`Could not verify the key: ${err instanceof Error ? err.message : String(err)}`);
  }
  const secretEncrypted = encrypt(apiKey);
  await db.projectCredential.upsert({
    where: { projectId_provider: { projectId, provider: "SERPER" } },
    create: { projectId, provider: "SERPER", login: "", secretEncrypted, rankDepth },
    update: { secretEncrypted, rankDepth },
  });
  return done(projectId);
}

export async function saveProjectBing(input: ProjectBingInput): Promise<ActionResult<{ sites: number }>> {
  const parsed = projectBingSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const g = await guard(parsed.data.projectId);
  if (!g.allowed) return g.error;
  const { projectId, apiKey } = parsed.data;
  let sites: string[];
  try {
    sites = await listBingSites(apiKey);
  } catch (err) {
    return fail(`Could not verify the key: ${err instanceof Error ? err.message : String(err)}`);
  }
  const secretEncrypted = encrypt(apiKey);
  await db.projectCredential.upsert({
    where: { projectId_provider: { projectId, provider: "BING" } },
    create: { projectId, provider: "BING", login: "", secretEncrypted },
    update: { secretEncrypted },
  });
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok({ sites: sites.length });
}

export async function removeProjectKey(projectId: string, provider: "DATAFORSEO" | "SERPER" | "BING"): Promise<ActionResult> {
  if (!["DATAFORSEO", "SERPER", "BING"].includes(provider)) return fail("Unknown provider.");
  const g = await guard(projectId);
  if (!g.allowed) return g.error;
  await db.projectCredential.deleteMany({ where: { projectId, provider } });
  return done(projectId);
}
