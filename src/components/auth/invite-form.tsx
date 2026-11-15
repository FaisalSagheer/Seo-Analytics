"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { acceptInvite } from "@/lib/actions/invite";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function InviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", password: "" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await acceptInvite({ token, ...form });
      if (!res.ok) return void toast.error(res.error);
      const signed = await signIn("credentials", { email, password: form.password, redirect: false });
      if (!signed || signed.error) {
        toast.error("Account created. Sign in with your new password.");
        router.push("/sign-in");
        return;
      }
      toast.success("Welcome to the team.");
      setForm({ name: "", password: "" });
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="inv-email">Email</FieldLabel>
          <Input id="inv-email" value={email} readOnly className="text-muted-foreground" />
          <FieldDescription>Your invitation is for this address.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="inv-name">Your name</FieldLabel>
          <Input id="inv-name" autoComplete="name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="inv-password">Choose a password</FieldLabel>
          <Input
            id="inv-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Create account
        </Button>
      </FieldGroup>
    </form>
  );
}
