/**
 * What a role can be granted. Viewing projects needs no permission: every
 * signed-in user sees every project, and a role only decides what they change.
 *
 * Managing team members and roles isn't listed: it belongs to the built-in
 * Admin role alone. A custom role holding it could edit itself into anything.
 */
export const PERMISSIONS = {
  "projects.create": "Create projects",
  "projects.edit": "Edit project settings",
  "projects.delete": "Delete projects",
  "keywords.manage": "Add and remove keywords",
  "data.sync": "Run data syncs",
  "research.use": "Keyword and domain research (paid lookups)",
  "providers.manage": "Connect data providers",
  "apikeys.manage": "Create and use API keys",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Drops unknown keys, so a stale or hand-edited row can't grant anything new. */
export function sanitizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return PERMISSION_KEYS.filter((key) => value.includes(key));
}

export type ViewerRole = { id: string | null; name: string; isAdmin: boolean; permissions: Permission[] };
