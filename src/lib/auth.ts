import "server-only";
import { randomUUID } from "node:crypto";
import NextAuth, { type Account, type NextAuthConfig, type Profile } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";
import { GOOGLE_DATA_SCOPES } from "@/lib/providers/google";
import { assignInitialRole } from "@/lib/roles";
import { signupOpen } from "@/lib/signup";

const e = env();

// NextAuth reads its public origin from AUTH_URL; feed it from APP_URL so there's one setting
process.env.AUTH_URL = e.APP_URL;

const hasDataScopes = (scope: string | null | undefined) => {
  const scopes = (scope ?? "").split(/[ ,]+/);
  return GOOGLE_DATA_SCOPES.every((s) => scopes.includes(s));
};

/** Thrown only after the right password, so a deactivated account can't be told apart from a wrong one by probing. */
class AccountDisabledError extends CredentialsSignin {
  code = "account_disabled";
}

const providers: Provider[] = [];

if (e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: e.GOOGLE_CLIENT_ID,
      clientSecret: e.GOOGLE_CLIENT_SECRET,
      // Offline access so Search Console / GA4 can be synced by the cron job.
      // include_granted_scopes keeps the data scopes on a later plain sign-in.
      authorization: { params: { access_type: "offline", prompt: "select_account consent", include_granted_scopes: "true" } },
    }),
  );
}

providers.push(
  Credentials({
    credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
    // Return null, never throw, on a failed check: Auth.js reports anything
    // thrown here as a server configuration error instead of a bad sign-in.
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      if (!email || !password) return null;
      const user = await db.user.findUnique({
        where: { email },
        include: { accounts: { where: { providerId: "credential" } } },
      });
      const account = user?.accounts[0];
      if (!user || !account?.password) return null;
      const { ok, needsRehash } = await verifyPassword(account.password, password);
      if (!ok) return null;
      if (!user.isActive) throw new AccountDisabledError();
      if (needsRehash) {
        await db.account.update({ where: { id: account.id }, data: { password: await hashPassword(password) } });
      }
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
);

/**
 * Decides which of our users a Google sign-in belongs to and stores its tokens.
 * Signed in already: attaches Google to that user (Settings → Connect Google),
 * even under a different email. Otherwise: the user already linked to this
 * Google account, else one with the same verified email, else a new user.
 * Returns true, or a URL to send the browser to when refused.
 */
async function linkGoogle(account: Account, profile: Profile | undefined): Promise<true | string> {
  const sub = account.providerAccountId;
  const existing = await db.account.findFirst({ where: { providerId: "google", accountId: sub } });
  const session = await auth();
  const current = session?.user?.id ? await db.user.findUnique({ where: { id: session.user.id } }) : null;

  let userId: string;
  if (current) {
    if (existing && existing.userId !== current.id) return "/settings?google=in-use";
    userId = current.id;
  } else if (existing) {
    userId = existing.userId;
  } else {
    const email = profile?.email?.toLowerCase();
    if (!email || profile?.email_verified !== true) return "/sign-in?error=google-email";
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      // Passwords are set at sign-up without proving the address, so merging into an unverified
      // account would let whoever registered it first keep a way in after the real owner arrives
      if (!byEmail.emailVerified) return "/sign-in?error=google-email-unverified";
      userId = byEmail.id;
    } else {
      if (!(await signupOpen())) return "/sign-in?error=signup-disabled";
      userId = randomUUID();
      await db.user.create({
        data: {
          id: userId,
          email,
          name: profile?.name ?? email.split("@")[0],
          image: typeof profile?.picture === "string" ? profile.picture : null,
          emailVerified: true,
        },
      });
      await assignInitialRole(userId);
    }
  }

  // A plain sign-in must not replace tokens that carry the Search Console / GA4 scopes with ones that don't
  const keepStored = existing && hasDataScopes(existing.scope) && !hasDataScopes(account.scope);
  // A deactivated person can't sign in with Google either
  const owner = await db.user.findUnique({ where: { id: userId }, select: { isActive: true } });
  if (owner && !owner.isActive) return "/sign-in?error=account-disabled";

  const tokens = keepStored
    ? {}
    : {
        accessToken: account.access_token ? encrypt(account.access_token) : null,
        // Google only returns a refresh token on consent; keep the one we have otherwise
        ...(account.refresh_token ? { refreshToken: encrypt(account.refresh_token) } : {}),
        accessTokenExpiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
        scope: account.scope ?? null,
      };
  if (existing) {
    await db.account.update({ where: { id: existing.id }, data: tokens });
  } else {
    await db.account.create({ data: { id: randomUUID(), accountId: sub, providerId: "google", userId, ...tokens } });
  }
  return true;
}

const config: NextAuthConfig = {
  secret: e.AUTH_SECRET,
  trustHost: true,
  providers,
  // No adapter: users and accounts are written by our own code, sessions are JWTs
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") return linkGoogle(account, profile);
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        // linkGoogle (above) has already decided the owner
        const row = await db.account.findFirst({ where: { providerId: "google", accountId: account.providerAccountId } });
        token.userId = row?.userId;
      } else if (account && user?.id) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth(config);
