import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { env, googleConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

/** Reads env at request time so ALLOW_SIGNUP isn't frozen into the build. */
async function SignUpForm() {
  await connection();
  const e = env();
  if (!e.ALLOW_SIGNUP) notFound();
  return <AuthForm mode="sign-up" googleEnabled={googleConfigured()} demoEnabled={e.DEMO_MODE} signupAllowed />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[28rem] w-full rounded-xl" />}>
      <SignUpForm />
    </Suspense>
  );
}
