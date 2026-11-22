"use server";

import { denied, requireProject } from "@/lib/session";
import { getGoogleAccessToken } from "@/lib/providers";
import { gscInspectUrl, type UrlInspection } from "@/lib/providers/google";
import { urlInProperty } from "@/lib/gsc-property";
import { LIMITS, rateHit, waitMessage } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

/** Asks Search Console how Google sees one URL of the project's site. */
export async function inspectUrl(projectId: string, input: string): Promise<ActionResult<{ url: string; result: UrlInspection }>> {
  const blocked = await denied("audit.create");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  if (project.isDemo) return fail("Demo projects have no Search Console site to inspect.");
  if (!project.gscSiteUrl) return fail("Choose a Search Console site in Project settings first.");
  if (typeof input !== "string" || input.length > 2048) return fail("Enter a page address of up to 2048 characters.");
  const url = urlInProperty(input, project.gscSiteUrl);
  if (!url) return fail(`That address isn't part of the Search Console site ${project.gscSiteUrl.replace(/^sc-domain:/, "")}.`);

  const hit = await rateHit("inspect", project.id, LIMITS.inspect.max, LIMITS.inspect.window);
  if (!hit.ok) return fail(waitMessage(hit.retryAfter));
  try {
    const token = await getGoogleAccessToken(project);
    return ok({ url, result: await gscInspectUrl(token, project.gscSiteUrl, url) });
  } catch (err) {
    return fail(err instanceof Error ? `Search Console: ${err.message}` : "Search Console couldn't inspect that URL.");
  }
}
