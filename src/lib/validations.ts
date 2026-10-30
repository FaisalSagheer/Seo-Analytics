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
  languageCode: z.string().trim().min(2).max(8).default("en"),
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

export const trackIdeasSchema = z.object({
  projectId: z.string().min(1),
  ideas: z
    .array(z.object({ keyword: z.string().trim().toLowerCase().min(1).max(700), searchVolume: z.number().int().nonnegative() }))
    .min(1)
    .max(500),
});
export type TrackIdeasInput = z.input<typeof trackIdeasSchema>;

export const deleteKeywordsSchema = z.object({
  projectId: z.string().min(1),
  keywordIds: z.array(z.string().min(1)).min(1).max(500),
});
export type DeleteKeywordsInput = z.input<typeof deleteKeywordsSchema>;

export const keywordIdeasSchema = z.object({
  projectId: z.string().min(1),
  seeds: z
    .string()
    .transform((s) => [...new Set(s.split(/[,\n]/).map((p) => p.trim().toLowerCase()).filter(Boolean))])
    .pipe(z.array(z.string().max(80)).min(1, "Enter a seed keyword").max(20)),
  limit: z.coerce.number().int().min(10).max(1000).default(200),
  ...marketSchema.shape,
});
export type KeywordIdeasInput = z.input<typeof keywordIdeasSchema>;

export const domainLookupSchema = z.object({
  projectId: z.string().min(1),
  domain,
});
export type DomainLookupInput = z.input<typeof domainLookupSchema>;

export const providerCredentialSchema = z.object({
  login: z.string().trim().min(1, "Login is required").max(200),
  password: z.string().min(1, "Password is required").max(200),
});
export type ProviderCredentialInput = z.input<typeof providerCredentialSchema>;

export const serperCredentialSchema = z.object({
  /** Empty means "keep the saved key, only change the depth" */
  apiKey: z.string().trim().max(200).default(""),
  rankDepth: z.coerce
    .number()
    .int()
    .refine((n) => [10, 20, 30, 50, 100].includes(n), "Depth must be 10, 20, 30, 50 or 100"),
});
export type SerperCredentialInput = z.input<typeof serperCredentialSchema>;

export const bingCredentialSchema = z.object({
  apiKey: z.string().trim().min(1, "Enter your Bing Webmaster Tools API key").max(200),
});
export type BingCredentialInput = z.input<typeof bingCredentialSchema>;

export const projectBacklinkSourcesSchema = z.object({
  projectId: z.string().min(1),
  backlinksDataForSeo: z.boolean(),
  backlinksBing: z.boolean(),
  bingSiteUrl: z.string().trim().max(500).nullable().transform((v) => v || null),
});
export type ProjectBacklinkSourcesInput = z.input<typeof projectBacklinkSourcesSchema>;

export const apiKeySchema = z.object({
  name: z.string().trim().min(1, "Name the key").max(60),
});
export type ApiKeyInput = z.input<typeof apiKeySchema>;

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Name the role").max(40),
  description: z.string().trim().max(255).default(""),
  permissions: z.array(z.enum(PERMISSION_KEYS as [Permission, ...Permission[]])).default([]),
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
