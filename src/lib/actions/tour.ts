"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

/** The first-login tour was finished or skipped; it isn't shown automatically again. */
export async function markTourSeen() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { tourSeenAt: new Date() } });
}
