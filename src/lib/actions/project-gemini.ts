"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { denied, requireProject } from "@/lib/session";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

/** A project's Gemini API key (from Google AI Studio). Anyone who can edit the project may add, replace or remove it. */

const saveSchema = z.object({ projectId: z.string().min(1), apiKey: z.string().trim().min(20, "That doesn't look like a Gemini API key.").max(200) });
export type SaveProjectGeminiInput = z.input<typeof saveSchema>;

export async function saveProjectGemini(input: SaveProjectGeminiInput): Promise<ActionResult<{ hint: string }>> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const { apiKey } = parsed.data;

  // Prove the key works before storing it: listing models needs a valid key and costs nothing
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) return fail("Google rejected this key. Check it in Google AI Studio and try again.");
    if (!res.ok) return fail(`Google couldn't check the key right now (error ${res.status}). Try again in a minute.`);
  } catch {
    return fail("Couldn't reach Google to check the key. Try again in a minute.");
  }

  // Only the last characters are kept readable, so the page can say which key is saved
  const hint = `…${apiKey.slice(-4)}`;
  await db.projectCredential.upsert({
    where: { projectId_provider: { projectId: project.id, provider: "GEMINI" } },
    create: { projectId: project.id, provider: "GEMINI", login: hint, secretEncrypted: encrypt(apiKey) },
    update: { login: hint, secretEncrypted: encrypt(apiKey) },
  });
  revalidatePath(`/projects/${project.id}/settings`);
  return ok({ hint });
}

export async function removeProjectGemini(projectId: string): Promise<ActionResult> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  await db.projectCredential.deleteMany({ where: { projectId: project.id, provider: "GEMINI" } });
  revalidatePath(`/projects/${project.id}/settings`);
  return ok(undefined);
}
