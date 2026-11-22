"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { can, denied, requireProject, requireUser } from "@/lib/session";
import { propertyChoiceDenied } from "@/lib/google-access";
import { seedDemoProject } from "@/lib/demo/seed-project";
import { env } from "@/lib/env";
import { LOCATIONS, locationLabel } from "@/lib/markets";
import { syncProject, type SyncPart, type SyncResult } from "@/lib/sync";
import {
  addKeywordsSchema,
  deleteKeywordsSchema,
  projectGoogleSchema,
  projectSchema,
  type AddKeywordsInput,
  type DeleteKeywordsInput,
  type ProjectGoogleInput,
  type ProjectInput,
} from "@/lib/validations";
import { fail, ok, zodError, type ActionResult } from "@/lib/actions/result";

export async function createProject(input: ProjectInput): Promise<ActionResult<{ id: string }>> {
  const blocked = await denied("projects.create");
  if (blocked) return blocked;
  const user = await requireUser();
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  // The creator is a member, so a role that doesn't see every project can still open what it made
  const project = await db.project.create({
    data: { ...parsed.data, userId: user.id, members: { create: { userId: user.id } } },
  });
  revalidatePath("/projects");
  return ok({ id: project.id });
}

export async function updateProject(projectId: string, input: ProjectInput): Promise<ActionResult> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  await requireProject(projectId);
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  await db.project.update({ where: { id: projectId }, data: parsed.data });
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(undefined);
}

export async function updateProjectGoogle(input: ProjectGoogleInput): Promise<ActionResult> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const parsed = projectGoogleSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const notYours = await propertyChoiceDenied(project);
  if (notYours) return notYours;
  const { projectId, ...data } = parsed.data;
  await db.project.update({ where: { id: projectId }, data });
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(undefined);
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const blocked = await denied("projects.delete");
  if (blocked) return blocked;
  await requireProject(projectId);
  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/projects");
  return ok(undefined);
}

export async function createDemoProject(): Promise<ActionResult<{ id: string }>> {
  const blocked = await denied("projects.create");
  if (blocked) return blocked;
  if (!env().DEMO_MODE) return fail("Demo mode is disabled on this server.");
  const user = await requireUser();
  const project = await seedDemoProject(db, user.id);
  revalidatePath("/projects");
  return ok({ id: project.id });
}

export async function addKeywords(input: AddKeywordsInput): Promise<ActionResult<{ added: number }>> {
  const blocked = await denied("rankings.create");
  if (blocked) return blocked;
  const parsed = addKeywordsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const { count } = await db.keyword.createMany({
    data: parsed.data.phrases.map((phrase) => ({
      projectId: project.id,
      phrase,
      tags: parsed.data.tags,
      searchVolume: parsed.data.searchVolume,
    })),
    skipDuplicates: true,
  });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ added: count });
}

export async function deleteKeywords(input: DeleteKeywordsInput): Promise<ActionResult<{ deleted: number }>> {
  const blocked = await denied("rankings.delete");
  if (blocked) return blocked;
  const parsed = deleteKeywordsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const { count } = await db.keyword.deleteMany({ where: { projectId: project.id, id: { in: parsed.data.keywordIds } } });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ deleted: count });
}

export async function runSync(projectId: string, parts?: SyncPart[]): Promise<ActionResult<SyncResult>> {
  // Each part has its own permission; asking for both runs the ones the role may
  const wanted: SyncPart[] = parts ?? ["rankings", "google"];
  const needed = { rankings: "rankings.edit", google: "analytics.edit" } as const;
  const allowed = (await Promise.all(wanted.map(async (part) => ((await can(needed[part])) ? part : null)))).filter((x): x is SyncPart => x != null);
  if (!allowed.length) return fail("Your role doesn't allow this.");
  const { project } = await requireProject(projectId);
  try {
    const result = await syncProject(project, allowed);
    revalidatePath(`/projects/${projectId}`, "layout");
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Changes the project's target country (the same setting as Project settings → Location).
 * Rankings are measured per country, so the project's Search Console rank history is
 * rebuilt for the new country instead of mixing two countries in one line.
 */
export async function setProjectCountry(
  projectId: string,
  locationCode: number,
): Promise<ActionResult<{ country: string; synced: boolean; warning?: string }>> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  if (!LOCATIONS.some((l) => l.code === locationCode)) return fail("Pick a country from the list.");
  const country = locationLabel(locationCode);
  if (project.locationCode === locationCode) return ok({ country, synced: false });

  const updated = await db.project.update({ where: { id: project.id }, data: { locationCode } });
  let synced = false;
  let warning: string | undefined;
  // Demo rankings are generated, and without a Search Console site there is nothing to re-measure yet
  if (!project.isDemo && project.gscSiteUrl) {
    // Each keyword's old-country history is replaced only once its new data has arrived
    const result = await syncProject(updated, ["rankings"], { replaceHistory: true });
    synced = Boolean(result.rankings?.ok);
    warning = result.rankings?.ok ? result.rankings.warning : `Rankings couldn't be updated yet: ${result.rankings?.message ?? "unknown error"}`;
  }
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ country, synced, warning });
}
