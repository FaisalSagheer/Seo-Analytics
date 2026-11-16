import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ResetForm } from "@/components/auth/reset-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { findUsableReset } from "@/lib/password-reset";

export const metadata: Metadata = { title: "Choose a new password" };

async function Reset({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const reset = await findUsableReset(token);
  if (!reset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This link can&apos;t be used</CardTitle>
          <CardDescription>It has expired, was already used, or the link is wrong. Ask for a new one.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/forgot-password" className={buttonVariants({ variant: "outline" })}>
            Send a new link
          </Link>
        </CardFooter>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>This replaces your current password.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetForm token={token} email={reset.user.email} />
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
      <Reset params={params} />
    </Suspense>
  );
}
