"use client";

import { useTransition } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { signIn } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  // Merchant Center, for the Shopping page; optional for everything else
  "https://www.googleapis.com/auth/content",
];

export function GoogleCard({
  configured,
  connected,
  linked = false,
  inUse = false,
}: {
  configured: boolean;
  connected: boolean;
  /** A Google account is attached, whether or not it granted the data permissions */
  linked?: boolean;
  inUse?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      // Links (or re-consents) the Google account with read-only GSC + GA4 scopes
      // While signed in, the server attaches this Google account to the current user instead of switching user
      await signIn("google", { redirectTo: "/settings" }, { scope: ["openid", "email", "profile", ...SCOPES].join(" "), prompt: "consent" });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Search Console and GA4</CardTitle>
        <CardDescription>
          Read-only access to clicks, impressions and queries from Search Console, and organic sessions from GA4. Choose the
          properties per project in its settings.
        </CardDescription>
        <CardAction>
          {connected ? (
            <Badge variant="secondary">
              <CheckCircle2Icon data-icon="inline-start" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2">
        {linked && !connected && (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
            Google is connected, but Search Console and GA4 access wasn&apos;t granted, so syncing won&apos;t work. Click Reconnect Google and
            tick both permissions.
          </p>
        )}
        {inUse && (
          <p role="alert" className="text-destructive text-sm">
            That Google account is already connected to another user here. Pick a different Google account.
          </p>
        )}
        {configured ? (
          <Button variant={connected || linked ? "outline" : "default"} disabled={pending} onClick={connect}>
            {pending && <Spinner data-icon="inline-start" />}
            {connected || linked ? "Reconnect Google" : "Connect Google"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            Set <code className="font-mono">GOOGLE_CLIENT_ID</code> and <code className="font-mono">GOOGLE_CLIENT_SECRET</code> on the server
            to enable this. The README walks through creating the OAuth client.
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
