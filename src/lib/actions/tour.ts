"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PAGE_TOURS } from "@/lib/tour-pages";

/** The first-login tour was finished or skipped; it isn't shown automatically again. */
export async function markTourSeen() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { tourSeenAt: new Date() } });
}

/** A page's tour was finished or skipped. Only known page keys are stored. */
export async function markPageTourSeen(key: string) {
  if (!(key in PAGE_TOURS)) return;
  const user = await requireUser();
  const row = await db.user.findUnique({ where: { id: user.id }, select: { pageToursSeen: true } });
  const seen = new Set((row?.pageToursSeen ?? "").split(",").filter(Boolean));
  if (seen.has(key)) return;
  seen.add(key);
  await db.user.update({ where: { id: user.id }, data: { pageToursSeen: [...seen].join(",") } });
}
