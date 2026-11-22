/**
 * What a role can be granted. Viewing needs no permission: a role decides what a
 * user can change, and whether they see every project or only the ones they're added to.
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
  "providers.manage": "Connect Google (Search Console and GA4)",
  "apikeys.manage": "Create and use API keys",
  "merchant.manage": "Manage Merchant Center (products, shipping, feeds, promotions, store settings, people and access)",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Drops unknown keys, so a stale or hand-edited row can't grant anything new. */
export function sanitizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return PERMISSION_KEYS.filter((key) => value.includes(key));
}

export type ViewerRole = {
  id: string | null;
  name: string;
  isAdmin: boolean;
  /** True: sees every project. False: only the projects the user is a member of. */
  seeAllProjects: boolean;
  permissions: Permission[];
};
