"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denied, requireProject, requireUser } from "@/lib/session";
import { seedDemoProject } from "@/lib/demo/seed-project";
import { syncProject, type SyncPart, type SyncResult } from "@/lib/sync";
import {
  addKeywordsSchema,
  deleteKeywordsSchema,
  projectGoogleSchema,
  projectSchema,
  projectBacklinkSourcesSchema,
  type ProjectBacklinkSourcesInput,
  trackIdeasSchema,
  type TrackIdeasInput,
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
  const project = await db.project.create({ data: { ...parsed.data, userId: user.id } });
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
  await requireProject(parsed.data.projectId);
  const { projectId, ...data } = parsed.data;
  await db.project.update({ where: { id: projectId }, data });
  revalidatePath(`/projects/${projectId}`, "layout");
  return ok(undefined);
}

export async function updateProjectBacklinkSources(input: ProjectBacklinkSourcesInput): Promise<ActionResult> {
  const blocked = await denied("projects.edit");
  if (blocked) return blocked;
  const parsed = projectBacklinkSourcesSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { projectId, ...data } = parsed.data;
  await requireProject(projectId);
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
  const user = await requireUser();
  const project = await seedDemoProject(db, user.id);
  revalidatePath("/projects");
  return ok({ id: project.id });
}

export async function addKeywords(input: AddKeywordsInput): Promise<ActionResult<{ added: number }>> {
  const blocked = await denied("keywords.manage");
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

export async function trackIdeas(input: TrackIdeasInput): Promise<ActionResult<{ added: number }>> {
  const blocked = await denied("keywords.manage");
  if (blocked) return blocked;
  const parsed = trackIdeasSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const { count } = await db.keyword.createMany({
    data: parsed.data.ideas.map((i) => ({ projectId: project.id, phrase: i.keyword, searchVolume: i.searchVolume, tags: "research" })),
    skipDuplicates: true,
  });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ added: count });
}

export async function deleteKeywords(input: DeleteKeywordsInput): Promise<ActionResult<{ deleted: number }>> {
  const blocked = await denied("keywords.manage");
  if (blocked) return blocked;
  const parsed = deleteKeywordsSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { project } = await requireProject(parsed.data.projectId);
  const { count } = await db.keyword.deleteMany({ where: { projectId: project.id, id: { in: parsed.data.keywordIds } } });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({ deleted: count });
}

export async function runSync(projectId: string, parts?: SyncPart[]): Promise<ActionResult<SyncResult>> {
  const blocked = await denied("data.sync");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  try {
    const result = await syncProject(project, parts);
    revalidatePath(`/projects/${projectId}`, "layout");
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
