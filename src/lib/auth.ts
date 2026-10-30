import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { assignInitialRole } from "@/lib/roles";

const e = env();
const google =
  e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: e.GOOGLE_CLIENT_ID,
          clientSecret: e.GOOGLE_CLIENT_SECRET,
          // Offline access so Search Console / GA4 can be synced by the cron job
          accessType: "offline" as const,
          prompt: "select_account consent" as const,
          disableSignUp: !e.ALLOW_SIGNUP,
        },
      }
    : undefined;

export const auth = betterAuth({
  baseURL: e.BETTER_AUTH_URL,
  secret: e.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "mysql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    disableSignUp: !e.ALLOW_SIGNUP,
  },
  socialProviders: google,
  account: {
    // Lets an email/password user attach Google for Search Console + GA4
    accountLinking: { enabled: true, trustedProviders: ["google"], allowDifferentEmails: true },
    encryptOAuthTokens: true,
  },
  databaseHooks: {
    user: { create: { after: (user) => assignInitialRole(user.id) } },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
