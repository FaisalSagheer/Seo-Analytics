import "server-only";
import { db } from "@/lib/db";
import { auditScore, crawlSite } from "@/lib/audit/crawl";
import type { Prisma } from "@/generated/prisma/client";

const STALE_AFTER_MS = 10 * 60_000;
const KEEP_RUNS = 5;

export class AuditInProgressError extends Error {
  constructor() {
    super("An audit is already running for this project.");
    this.name = "AuditInProgressError";
  }
}

/** Crawls the project's site and stores the result. Resolves with the finished run's id. */
export async function runAudit(project: { id: string; domain: string }, opts?: { maxPages?: number }) {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  // A run that died with the process would otherwise block new audits forever
  await db.auditRun.updateMany({
    where: { projectId: project.id, status: "RUNNING", startedAt: { lt: cutoff } },
    data: { status: "FAILED", error: "Timed out", finishedAt: new Date() },
  });
  if (await db.auditRun.count({ where: { projectId: project.id, status: "RUNNING" } })) throw new AuditInProgressError();

  const run = await db.auditRun.create({ data: { projectId: project.id, startUrl: `https://${project.domain}/` } });
  try {
    const result = await crawlSite(project.domain, { maxPages: opts?.maxPages });
    await db.$transaction([
      db.auditPage.createMany({
        data: result.pages.map((p) => ({
          runId: run.id,
          url: p.url.slice(0, 2048),
          statusCode: p.statusCode,
          title: p.title?.slice(0, 1000) ?? null,
          metaDescription: p.metaDescription?.slice(0, 2000) ?? null,
          h1: p.h1?.slice(0, 1000) ?? null,
          h1Count: p.h1Count,
          canonical: p.canonical?.slice(0, 2048) ?? null,
          wordCount: p.wordCount,
          loadMs: p.loadMs,
          internalLinks: p.internalLinks,
          externalLinks: p.externalLinks,
          issues: p.issues as Prisma.InputJsonValue,
        })),
      }),
      db.auditRun.update({
        where: { id: run.id },
        data: {
          status: "DONE",
          startUrl: result.startUrl.slice(0, 2048),
          pagesCrawled: result.pages.length,
          score: auditScore(result.pages, result.siteIssues),
          siteIssues: result.siteIssues as Prisma.InputJsonValue,
          finishedAt: new Date(),
        },
      }),
    ]);
    const old = await db.auditRun.findMany({
      where: { projectId: project.id },
      orderBy: { startedAt: "desc" },
      skip: KEEP_RUNS,
      select: { id: true },
    });
    if (old.length) await db.auditRun.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    return run.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit failed";
    await db.auditRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message.slice(0, 500), finishedAt: new Date() } });
    throw err;
  }
}
