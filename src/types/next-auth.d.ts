import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    /** When the session token was issued, in seconds; compared with the user's sessionsValidFrom */
    issuedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Our user.id. The Google `sub` is never used as the user id. */
    userId?: string;
  }
}
