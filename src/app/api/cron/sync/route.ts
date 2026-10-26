import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { apiError } from "@/lib/api";
import { syncProject } from "@/lib/sync";

export const maxDuration = 800;

/**
 * Daily sync for every project. Call it from cron / Task Scheduler / `npm run sync`
 * with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return apiError(503, "CRON_SECRET is not set on the server.");
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return apiError(401, "Invalid cron secret");

  const projects = await db.project.findMany();
  const results = [];
  for (const project of projects) {
    // Sequential: keeps provider concurrency predictable and costs easy to reason about
    results.push({ projectId: project.id, domain: project.domain, result: await syncProject(project) });
  }
  return NextResponse.json({ data: results });
}
