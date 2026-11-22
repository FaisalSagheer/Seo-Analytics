/**
 * What a role can be granted. Viewing needs no permission: a role decides what a
 * user can change, and whether they see every project or only the ones they're added to.
 *
 * Permissions are named page.action (create, edit or delete) and laid out in PERMISSION_LAYOUT the
 * way the sidebar is, so the Team page shows them in the same groups. A page only has the actions
 * it really offers.
 *
 * Managing team members and roles isn't listed: it belongs to the built-in
 * Admin role alone. A custom role holding it could edit itself into anything.
 */
export const PERMISSIONS = {
  // Your website: analytics
  "analytics.edit": "Sync Google data (Performance, Reports, Referrals, Overview)",
  // Your website: SEO tools
  "rankings.create": "Add keywords",
  "rankings.edit": "Check rankings now",
  "rankings.delete": "Remove keywords",
  "audit.create": "Run site audits and inspect URLs",
  "backlinks.create": "Import backlinks",
  "backlinks.delete": "Delete backlink imports",
  // Your website: projects
  "projects.create": "Create projects",
  "projects.edit": "Edit project settings",
  "projects.delete": "Delete projects",
  // Merchant Center: products and store
  "products.create": "Add products",
  "products.edit": "Edit products, revert edits, resume paused products",
  "products.delete": "Delete or pause products",
  "shipping.create": "Add regions and return policies",
  "shipping.edit": "Edit shipping, regions and return policies",
  "shipping.delete": "Delete regions and return policies",
  "reviews.delete": "Remove product reviews",
  // Merchant Center: creative content
  "product-studio.edit": "Use Product Studio (applying a suggestion also needs Products: edit)",
  "video-assets.edit": "Set product video links",
  // Merchant Center: marketing
  "promotions.create": "Create promotions",
  "promotions.edit": "End promotions",
  "brand.edit": "Edit business identity labels",
  "marketing-methods.edit": "Turn marketing methods (programs) on or off",
  // Merchant Center: settings
  "store-info.edit": "Edit business info and the homepage claim",
  "feeds.create": "Add scheduled feeds",
  "feeds.edit": "Fetch, pause or resume feeds",
  "feeds.delete": "Delete data sources (and their products)",
  "people.create": "Invite people to the Merchant Center account",
  "people.edit": "Change people's access rights",
  "people.delete": "Remove people from the Merchant Center account",
  "apps.create": "Link a Business Profile",
  "apps.edit": "Approve or reject linked services",
  "conversions.create": "Add conversion sources",
  "conversions.edit": "Change conversion attribution",
  "conversions.delete": "Remove conversion sources",
  "auto-improvements.edit": "Change automatic improvements",
  // Account
  "google.edit": "Connect Google (Search Console, GA4) and register Merchant Center",
  "apikeys.create": "Create and use API keys",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

export type PermissionAction = "create" | "edit" | "delete";
export type PermissionPage = { label: string } & Partial<Record<PermissionAction, Permission>>;

/** The permissions as the Team page shows them: areas, groups and pages in the sidebar's order. */
export const PERMISSION_LAYOUT: { area: string; groups: { label: string; pages: PermissionPage[] }[] }[] = [
  {
    area: "Your website",
    groups: [
      { label: "Analytics", pages: [{ label: "Performance, Reports, Referrals", edit: "analytics.edit" }] },
      {
        label: "SEO tools",
        pages: [
          { label: "Rankings", create: "rankings.create", edit: "rankings.edit", delete: "rankings.delete" },
          { label: "Site audit", create: "audit.create" },
          { label: "Backlinks", create: "backlinks.create", delete: "backlinks.delete" },
        ],
      },
      { label: "Projects", pages: [{ label: "Projects and project settings", create: "projects.create", edit: "projects.edit", delete: "projects.delete" }] },
    ],
  },
  {
    area: "Merchant Center",
    groups: [
      {
        label: "Products & store",
        pages: [
          { label: "Products", create: "products.create", edit: "products.edit", delete: "products.delete" },
          { label: "Shipping and returns", create: "shipping.create", edit: "shipping.edit", delete: "shipping.delete" },
          { label: "Reviews", delete: "reviews.delete" },
        ],
      },
      { label: "Creative content", pages: [{ label: "Product Studio", edit: "product-studio.edit" }, { label: "Video assets", edit: "video-assets.edit" }] },
      {
        label: "Marketing",
        pages: [
          { label: "Promotions", create: "promotions.create", edit: "promotions.edit" },
          { label: "Brand", edit: "brand.edit" },
          { label: "Marketing methods", edit: "marketing-methods.edit" },
        ],
      },
      {
        label: "Business settings",
        pages: [
          { label: "Business info", edit: "store-info.edit" },
          { label: "Data sources", create: "feeds.create", edit: "feeds.edit", delete: "feeds.delete" },
          { label: "People and access", create: "people.create", edit: "people.edit", delete: "people.delete" },
          { label: "Apps and services", create: "apps.create", edit: "apps.edit" },
          { label: "Conversion settings", create: "conversions.create", edit: "conversions.edit", delete: "conversions.delete" },
          { label: "Automatic improvements", edit: "auto-improvements.edit" },
        ],
      },
    ],
  },
  {
    area: "Account",
    groups: [{ label: "Google & API", pages: [{ label: "Google connection", edit: "google.edit" }, { label: "API keys", create: "apikeys.create" }] }],
  },
];

/** Every Merchant Center permission, for "can this role change the store at all?". */
export const MERCHANT_PERMISSIONS: Permission[] = PERMISSION_LAYOUT.find((a) => a.area === "Merchant Center")!.groups.flatMap((g) =>
  g.pages.flatMap((p) => [p.create, p.edit, p.delete].filter((k): k is Permission => k != null)),
);

/**
 * Roles saved before permissions were split by page hold these broad keys. They're expanded to the
 * pages they used to cover, so nobody gains or loses anything when this ships.
 */
const LEGACY: Record<string, Permission[]> = {
  "keywords.manage": ["rankings.create", "rankings.delete"],
  "data.sync": ["analytics.edit", "rankings.edit", "audit.create", "backlinks.create", "backlinks.delete"],
  "providers.manage": ["google.edit"],
  "apikeys.manage": ["apikeys.create"],
  "merchant.manage": MERCHANT_PERMISSIONS,
};

/** Drops unknown keys, so a stale or hand-edited row can't grant anything new, and expands the old broad keys. */
export function sanitizePermissions(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  const granted = new Set<Permission>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    if (v in PERMISSIONS) granted.add(v as Permission);
    else for (const p of LEGACY[v] ?? []) granted.add(p);
  }
  return PERMISSION_KEYS.filter((key) => granted.has(key));
}

/** A role's permissions in words, by page: "Products: create, edit · Feeds: create, edit, delete". */
export function describePermissions(permissions: Permission[]): string {
  const has = new Set(permissions);
  const parts: string[] = [];
  for (const area of PERMISSION_LAYOUT)
    for (const group of area.groups)
      for (const page of group.pages) {
        const actions = (["create", "edit", "delete"] as const).filter((a) => page[a] && has.has(page[a]!));
        if (actions.length) parts.push(`${page.label}: ${actions.join(", ")}`);
      }
  return parts.join(" · ");
}

export type ViewerRole = {
  id: string | null;
  name: string;
  isAdmin: boolean;
  /** True: sees every project. False: only the projects the user is a member of. */
  seeAllProjects: boolean;
  permissions: Permission[];
};
