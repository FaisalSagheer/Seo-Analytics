"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetPassword } from "@/lib/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function ResetForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ password: "", confirm: "" });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (form.password !== form.confirm) return void toast.error("The two passwords don't match.");
        startTransition(async () => {
          const res = await resetPassword({ token, password: form.password });
          if (!res.ok) return void toast.error(res.error);
          setForm({ password: "", confirm: "" });
          toast.success("Password updated. Sign in with it.");
          router.push("/sign-in");
        });
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="rp-email">Email</FieldLabel>
          <Input id="rp-email" value={email} readOnly className="text-muted-foreground" />
        </Field>
        <Field>
          <FieldLabel htmlFor="rp-password">New password</FieldLabel>
          <Input id="rp-password" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <FieldDescription>At least 8 characters. You&apos;ll be signed out everywhere else.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="rp-confirm">Repeat it</FieldLabel>
          <Input id="rp-confirm" type="password" autoComplete="new-password" required minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Set new password
        </Button>
      </FieldGroup>
    </form>
  );
}
