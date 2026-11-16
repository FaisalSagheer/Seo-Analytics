import "server-only";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z.object({
  // Connection: DATABASE_URL, or DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME (see lib/database-url.ts)
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_NAME: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  // Public URL of the app. AUTH_URL is the previous name and still works.
  APP_URL: z.url().optional(),
  AUTH_URL: z.url().optional(),
  /// 64 hex chars (32 bytes) used to encrypt stored provider secrets
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "APP_ENCRYPTION_KEY must be 64 hex characters"),
  DEMO_MODE: bool,
  DEMO_EMAIL: z.email().default("demo@seoengine.local"),
  DEMO_PASSWORD: z.string().min(8).default("demo-password-123"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // Email (optional). Invites are emailed when SMTP_HOST and SMTP_FROM are set; otherwise the admin copies the link.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Closed unless explicitly turned on: a new account gets the default role (Editor, by default)
  ALLOW_SIGNUP: bool,
  // How many reverse proxies sit in front of the app and append to X-Forwarded-For. Rate limits count
  // the address the last trusted proxy saw; 0 ignores the header (everyone shares one bucket).
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
});

export type Env = z.infer<typeof envSchema> & { APP_URL: string };

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  // APP_URL wins, then the legacy AUTH_URL, then local development
  // Trailing slashes are dropped: links are built as `${APP_URL}/path`
  const appUrl = (parsed.data.APP_URL ?? parsed.data.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  cached = { ...parsed.data, APP_URL: appUrl };
  return cached;
}

export function googleConfigured() {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}
