import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { env, googleConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

/** Reads env at request time so DEMO_MODE / Google flags aren't frozen into the build. */
const ERRORS: Record<string, string> = {
  "signup-disabled": "New sign-ups are disabled. Ask an admin for an account.",
  "google-email": "That Google account has no verified email address.",
  AccessDenied: "Sign-in was refused.",
  Configuration: "Sign-in is misconfigured on the server. Check the server logs.",
};

async function SignInForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const e = env();
  const code = (await searchParams).error;
  const error = typeof code === "string" ? (ERRORS[code] ?? "Could not sign in. Try again.") : undefined;
  return <AuthForm mode="sign-in" googleEnabled={googleConfigured()} demoEnabled={e.DEMO_MODE} signupAllowed={e.ALLOW_SIGNUP} error={error} />;
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}
