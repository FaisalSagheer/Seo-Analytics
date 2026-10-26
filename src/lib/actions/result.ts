import type { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): { ok: false; error: string } {
  if (typeof error === "string") return { ok: false, error };
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
}

export function zodError(error: z.ZodError) {
  return fail(error.issues[0]?.message ?? "Invalid input");
}
