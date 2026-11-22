"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getProjectReport } from "@/lib/queries";
import { requireProject } from "@/lib/session";
import { LIMITS, rateHit, waitMessage } from "@/lib/rate-limit";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { pageKey } from "@/lib/tour-pages";

/** Gemini suggestions for the page the user is on, from the project's own data. */

const MODEL = "gemini-2.5-flash";

const answerSchema = z.object({
  suggestions: z.array(z.object({ title: z.string().min(1).max(120), detail: z.string().min(1).max(400) })).min(1).max(5),
});
export type Suggestion = z.infer<typeof answerSchema>["suggestions"][number];

export async function getPageSuggestions(projectId: string, pathname: string): Promise<ActionResult<{ suggestions: Suggestion[] }>> {
  const { project } = await requireProject(projectId);
  const hit = await rateHit("assistant", project.id, LIMITS.assistant.max, LIMITS.assistant.window);
  if (!hit.ok) return fail(waitMessage(hit.retryAfter));

  const cred = await db.projectCredential.findUnique({ where: { projectId_provider: { projectId: project.id, provider: "GEMINI" } } });
  if (!cred) return fail("Add a Gemini key under Project settings first.");

  const page = pageKey(pathname) ?? "overview";
  const report = await getProjectReport(project.id, 28);
  // Only numbers and keyword phrases go to Google, never account details
  const data = report
    ? {
        website: project.domain,
        period: "last 28 days",
        totals: report.totals,
        biggestGains: report.movers.up.slice(0, 5).map((r) => ({ keyword: r.phrase, position: r.position, change: r.change })),
        biggestDrops: report.movers.down.slice(0, 5).map((r) => ({ keyword: r.phrase, position: r.position, change: r.change })),
      }
    : { website: project.domain, note: "No data yet" };

  let text: string;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": decrypt(cred.secretEncrypted) },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `You are an SEO and Google Shopping assistant for one website. Give 3 to 5 specific, practical suggestions for the page the user is on, using only the data provided. Don't invent numbers. If the data is missing or doesn't apply to this page, say so in a single suggestion.`,
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ page, data }) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              suggestions: {
                type: "ARRAY",
                items: { type: "OBJECT", properties: { title: { type: "STRING" }, detail: { type: "STRING" } }, required: ["title", "detail"] },
              },
            },
            required: ["suggestions"],
          },
        },
      }),
    });
    if (res.status === 429) return fail("Gemini is busy right now. Try again in a minute.");
    if (!res.ok) return fail(`Gemini couldn't answer (error ${res.status}). Check the key under Project settings.`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch {
    return fail("Couldn't reach Gemini. Try again in a moment.");
  }

  try {
    const parsed = answerSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fail("Gemini's answer wasn't in the expected format. Try again.");
    return ok({ suggestions: parsed.data.suggestions });
  } catch {
    return fail("Gemini's answer wasn't in the expected format. Try again.");
  }
}
