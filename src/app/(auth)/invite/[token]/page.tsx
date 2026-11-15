import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { InviteForm } from "@/components/auth/invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export const metadata: Metadata = { title: "Accept invitation" };

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { role: { select: { name: true } } } });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  if (!valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>This invitation can&apos;t be used</CardTitle>
          <CardDescription>It has expired, was already used, or the link is wrong. Ask the admin who invited you for a new link.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Join the team</CardTitle>
        <CardDescription>
          You&apos;ve been invited as <span className="text-foreground font-medium">{invite.role.name}</span>. Set up your account below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteForm token={token} email={invite.email} />
      </CardContent>
    </Card>
  );
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <Invite params={params} />
    </Suspense>
  );
}
