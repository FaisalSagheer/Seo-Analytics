import { z } from "zod";
import { bareDomain } from "@/lib/domain";
import { PERMISSION_KEYS, type Permission } from "@/lib/permissions";

const domain = z
  .string()
  .trim()
  .min(1, "Domain is required")
  .transform(bareDomain)
  .pipe(z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/, "Enter a domain like example.com"));

export const marketSchema = z.object({
  locationCode: z.coerce.number().int().positive().default(2840),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  domain,
  device: z.enum(["DESKTOP", "MOBILE"]).default("DESKTOP"),
  ...marketSchema.shape,
});
export type ProjectInput = z.input<typeof projectSchema>;

export const projectGoogleSchema = z.object({
  projectId: z.string().min(1),
  gscSiteUrl: z.string().trim().max(500).nullable().transform((v) => v || null),
  ga4PropertyId: z
    .string()
    .trim()
    .regex(/^\d*$/, "GA4 property id is digits only")
    .nullable()
    .transform((v) => v || null),
  merchantId: z
    .string()
    .trim()
    .regex(/^\d{0,20}$/, "Merchant Center id is digits only")
    .nullable()
    .optional()
    .transform((v) => v || null),
});
export type ProjectGoogleInput = z.input<typeof projectGoogleSchema>;

export const addKeywordsSchema = z.object({
  projectId: z.string().min(1),
  /** One per line */
  phrases: z
    .string()
    .transform((s) =>
      [...new Set(s.split(/\r?\n/).map((p) => p.trim().toLowerCase()).filter(Boolean))],
    )
    .pipe(z.array(z.string().max(700)).min(1, "Add at least one keyword").max(500, "Up to 500 keywords at a time")),
  tags: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).join(",")),
  searchVolume: z.coerce.number().int().nonnegative().optional(),
});
export type AddKeywordsInput = z.input<typeof addKeywordsSchema>;

export const deleteKeywordsSchema = z.object({
  projectId: z.string().min(1),
  keywordIds: z.array(z.string().min(1)).min(1).max(500),
});
export type DeleteKeywordsInput = z.input<typeof deleteKeywordsSchema>;

export const inviteSchema = z.object({
  email: z.email("Enter a valid email").trim().toLowerCase().max(191),
  roleId: z.string().min(1, "Pick a role"),
});
export type InviteInput = z.input<typeof inviteSchema>;

export const addUserSchema = z.object({
  name: z.string().trim().min(1, "Enter their name").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase().max(191),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  roleId: z.string().min(1, "Pick a role"),
  /** Only used when the role doesn't see every project */
  projectIds: z.array(z.string().min(1)).max(200).default([]),
});
export type AddUserInput = z.input<typeof addUserSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().min(1, "Enter your name").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type AcceptInviteInput = z.input<typeof acceptInviteSchema>;

export const resetRequestSchema = z.object({ email: z.email("Enter a valid email").trim().toLowerCase().max(191) });
export type ResetRequestInput = z.input<typeof resetRequestSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;


export const roleSchema = z.object({
  name: z.string().trim().min(1, "Name the role").max(40),
  description: z.string().trim().max(255).default(""),
  permissions: z.array(z.enum(PERMISSION_KEYS as [Permission, ...Permission[]])).default([]),
  /** Off for client roles: members then see only the projects they've been added to */
  seeAllProjects: z.boolean().default(true),
});
export type RoleInput = z.input<typeof roleSchema>;

// ---- Public API query params ----

export const apiRangeSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(28),
});

export const apiRankingsQuerySchema = apiRangeSchema.extend({
  keyword: z.string().optional(),
  tag: z.string().optional(),
});

export const apiAddKeywordsSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(700)).min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
