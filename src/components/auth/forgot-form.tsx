"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MailCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ForgotForm() {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheckIcon className="text-primary size-8" />
        <p className="text-sm">
          If there is an account for <span className="font-medium">{email}</span>, a link to choose a new password is on its way. It works once and
          expires in an hour.
        </p>
        <Link href="/sign-in" className="text-muted-foreground text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await requestPasswordReset({ email });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Check your email.");
          setSent(true);
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="fp-email">Email</FieldLabel>
          <Input id="fp-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Send reset link
        </Button>
        <Link href="/sign-in" className="text-muted-foreground text-center text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </FieldGroup>
    </form>
  );
}
