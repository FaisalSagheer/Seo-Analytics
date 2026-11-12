"use server";

import { revalidatePath } from "next/cache";
import { AuditInProgressError, runAudit } from "@/lib/audit/run";
import { denied, requireProject } from "@/lib/session";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

/** Crawls the project's own site (up to 50 pages) and stores the findings. */
export async function runSiteAudit(projectId: string): Promise<ActionResult<{ runId: string }>> {
  const blocked = await denied("data.sync");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  if (project.isDemo) return fail("Demo projects point at a fake domain, so there's no real site to crawl.");
  try {
    const runId = await runAudit(project);
    revalidatePath(`/projects/${projectId}/audit`);
    return ok({ runId });
  } catch (err) {
    revalidatePath(`/projects/${projectId}/audit`);
    if (err instanceof AuditInProgressError) return fail(err.message);
    return fail(err);
  }
}
