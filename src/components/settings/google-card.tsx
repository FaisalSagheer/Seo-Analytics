"use client";

import { useTransition } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly", "https://www.googleapis.com/auth/analytics.readonly"];

export function GoogleCard({ configured, connected }: { configured: boolean; connected: boolean }) {
  const [pending, startTransition] = useTransition();

  function connect() {
    startTransition(async () => {
      // Links (or re-consents) the Google account with read-only GSC + GA4 scopes
      const { error } = await authClient.linkSocial({ provider: "google", scopes: SCOPES, callbackURL: "/settings" });
      if (error) toast.error(error.message ?? "Could not start Google sign-in");
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
      <CardFooter>
        {configured ? (
          <Button variant={connected ? "outline" : "default"} disabled={pending} onClick={connect}>
            {pending && <Spinner data-icon="inline-start" />}
            {connected ? "Reconnect Google" : "Connect Google"}
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
