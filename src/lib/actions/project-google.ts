"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { denied, requireProject } from "@/lib/session";
import { listGa4Properties, listGscSites } from "@/lib/providers/google";
import { parseServiceAccountKey, serviceAccountAccessToken } from "@/lib/providers/google-auth";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/**
 * A project's own Google access: the client's service account key. Anyone whose
 * role can connect Google (admins always) may add, replace or remove it.
 */

const saveSchema = z.object({ projectId: z.string().min(1), keyJson: z.string().max(20_000) });
export type SaveProjectGoogleInput = z.input<typeof saveSchema>;

export async function saveProjectGoogle(input: SaveProjectGoogleInput): Promise<ActionResult<{ email: string; sites: number; properties: number }>> {
  const blocked = await denied("providers.manage");
  if (blocked) return blocked;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  if (project.isDemo) return fail("Demo projects use generated data and don't take a Google key.");

  let key;
  try {
    key = parseServiceAccountKey(parsed.data.keyJson);
  } catch (err) {
    return fail(err);
  }

  // Prove the key works before storing it: mint a token, then see what it can reach
  let sites: string[];
  let properties: { id: string; name: string }[];
  try {
    const token = await serviceAccountAccessToken(key);
    sites = await listGscSites(token);
    properties = await listGa4Properties(token).catch(() => []);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not verify the key.");
  }

  // Only what's needed is kept, so extra fields in the file never get stored
  const secretEncrypted = encrypt(JSON.stringify({ type: "service_account", client_email: key.client_email, private_key: key.private_key, project_id: key.project_id }));
  await db.projectCredential.upsert({
    where: { projectId_provider: { projectId: project.id, provider: "GOOGLE" } },
    create: { projectId: project.id, provider: "GOOGLE", login: key.client_email, secretEncrypted },
    update: { login: key.client_email, secretEncrypted },
  });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ email: key.client_email, sites: sites.length, properties: properties.length });
}

export async function removeProjectGoogle(projectId: string): Promise<ActionResult> {
  const blocked = await denied("providers.manage");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  await db.projectCredential.deleteMany({ where: { projectId: project.id, provider: "GOOGLE" } });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok(undefined);
}
