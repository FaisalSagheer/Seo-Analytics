import "server-only";
import { getGoogleSource } from "@/lib/providers";
import { getViewerRole, requireUser } from "@/lib/session";
import { fail } from "@/lib/actions/result";

/**
 * A project without its own service account reads through its owner's Google
 * connection, which can reach all of that person's sites. Only the owner or an
 * admin may choose which of them the project uses; a failed result to return, or null.
 */
export async function propertyChoiceDenied(project: { id: string; userId: string }) {
  if ((await getGoogleSource(project)).source !== "owner") return null;
  const [user, role] = await Promise.all([requireUser(), getViewerRole()]);
  if (role.isAdmin || project.userId === user.id) return null;
  return fail("This project uses its owner's Google account. Ask the owner or an admin to choose the site, or add a service account key to the project.");
}
