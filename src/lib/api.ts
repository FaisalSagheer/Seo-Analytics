import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { getProject } from "@/lib/queries";
import { resolveRole } from "@/lib/roles";
import type { Permission } from "@/lib/permissions";

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
  // A key acts as its owner, so it stops working the moment their role loses API access
  const role = await resolveRole(key.userId);
  if (!role.permissions.includes("apikeys.manage")) return null;
  // Best-effort; a failed timestamp write must not fail the request
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { userId: key.userId, role };
}

/**
 * Wraps a v1 handler: authenticates, loads the project for project routes, and
 * checks the key owner's role for writes.
 */
export function withApiAuth<P extends Record<string, string>>(
  handler: (ctx: { request: Request; userId: string; params: P; project: Awaited<ReturnType<typeof getProject>> }) => Promise<Response>,
  options: { permission?: Permission } = {},
) {
  return async (request: Request, context: { params: Promise<P> }) => {
    const auth = await authenticate(request);
    if (!auth) return apiError(401, "Missing or invalid API key. Send Authorization: Bearer <key>.");
    if (options.permission && !auth.role.permissions.includes(options.permission)) {
      return apiError(403, "This key's owner doesn't have permission for that.");
    }
    // Static routes (e.g. /projects) get no params object at all
    const params = ((await context?.params) ?? {}) as P;
    const project = params.projectId ? await getProject(params.projectId) : null;
    if (params.projectId && !project) return apiError(404, "Project not found");
    try {
      return await handler({ request, userId: auth.userId, params, project });
    } catch (err) {
      console.error("[api]", err);
      return apiError(500, "Internal error");
    }
  };
}

export function searchParamsOf(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams);
}
