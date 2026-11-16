import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { env, googleConfigured } from "@/lib/env";
import { signupOpen } from "@/lib/signup";

export const metadata: Metadata = { title: "Sign in" };

/** Reads env at request time so DEMO_MODE / Google flags aren't frozen into the build. */
const ERRORS: Record<string, string> = {
  "signup-disabled": "New sign-ups are disabled. Ask an admin for an account.",
  "account-disabled": "This account has been deactivated. Ask an admin to reactivate it.",
  account_disabled: "This account has been deactivated. Ask an admin to reactivate it.",
  "google-email": "That Google account has no verified email address.",
  "google-email-unverified": "An account with this email already exists. Sign in with its password, then connect Google from Settings.",
  AccessDenied: "Sign-in was refused.",
  Configuration: "Sign-in is misconfigured on the server. Check the server logs.",
};

const NOTICES: Record<string, string> = {
  "signin-required": "Sign in to continue.",
};

async function SignInForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const e = env();
  const sp = await searchParams;
  const code = sp.error;
  const error = typeof code === "string" ? (ERRORS[code] ?? "Could not sign in. Try again.") : undefined;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  return (
    <AuthForm mode="sign-in" googleEnabled={googleConfigured()} demoEnabled={e.DEMO_MODE} signupAllowed={await signupOpen()} error={error} warning={error ? undefined : notice} />
  );
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}
