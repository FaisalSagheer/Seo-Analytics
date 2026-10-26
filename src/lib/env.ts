import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  /// 64 hex chars (32 bytes) used to encrypt stored provider secrets
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "APP_ENCRYPTION_KEY must be 64 hex characters"),
  DEMO_MODE: bool,
  DEMO_EMAIL: z.email().default("demo@bisibility.local"),
  DEMO_PASSWORD: z.string().min(8).default("demo-password-123"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  DATAFORSEO_LOGIN: z.string().optional(),
  DATAFORSEO_PASSWORD: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  SERPER_RANK_DEPTH: z.coerce.number().int().min(10).max(100).default(50),
  BING_WEBMASTER_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ALLOW_SIGNUP: z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((v) => v === undefined || v === "" || v === "true" || v === "1"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function googleConfigured() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
