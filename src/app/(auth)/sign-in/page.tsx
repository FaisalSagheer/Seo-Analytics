import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { env, googleConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

/** Reads env at request time so DEMO_MODE / Google flags aren't frozen into the build. */
async function SignInForm() {
  await connection();
  const e = env();
  return <AuthForm mode="sign-in" googleEnabled={googleConfigured()} demoEnabled={e.DEMO_MODE} signupAllowed={e.ALLOW_SIGNUP} />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <SignInForm />
    </Suspense>
  );
}
