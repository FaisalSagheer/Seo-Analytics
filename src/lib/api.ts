import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export function apiError(status: number, message: string) {
  return NextResponse.json({ error: { status, message } }, { status });
}

/** Resolves `Authorization: Bearer bsk_...` to its owner, or null. */
export async function authenticate(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(bsk_[A-Za-z0-9_-]+)$/.exec(header.trim());
  if (!match) return null;
  const key = await db.apiKey.findUnique({ where: { hashedKey: sha256(match[1]) } });
  if (!key || key.revokedAt) return null;
  // Best-effort; a failed timestamp write must not fail the request
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: key.userId };
}

/**
 * Wraps a v1 handler: authenticates, and for project routes checks ownership,
 * so no handler can forget to scope its reads.
 */
export function withApiAuth<P extends Record<string, string>>(
  handler: (ctx: { request: Request; userId: string; params: P; project: Awaited<ReturnType<typeof ownedProject>> }) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    const auth = await authenticate(request);
    if (!auth) return apiError(401, "Missing or invalid API key. Send Authorization: Bearer <key>.");
    // Static routes (e.g. /projects) get no params object at all
    const params = ((await context?.params) ?? {}) as P;
    const project = params.projectId ? await ownedProject(params.projectId, auth.userId) : null;
    if (params.projectId && !project) return apiError(404, "Project not found");
    try {
      return await handler({ request, userId: auth.userId, params, project });
    } catch (err) {
      console.error("[api]", err);
      return apiError(500, "Internal error");
    }
  };
}

function ownedProject(projectId: string, userId: string) {
  return db.project.findFirst({ where: { id: projectId, userId } });
}

export function searchParamsOf(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
