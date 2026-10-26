"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { signInDemo } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
  demoEnabled: boolean;
  signupAllowed: boolean;
};

export function AuthForm({ mode, googleEnabled, demoEnabled, signupAllowed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const isSignUp = mode === "sign-up";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const { error } = isSignUp
        ? await authClient.signUp.email({ name: form.name, email: form.email, password: form.password })
        : await authClient.signIn.email({ email: form.email, password: form.password });
      if (error) {
        toast.error(error.message ?? "Could not sign in");
        return;
      }
      router.push("/projects");
      router.refresh();
    });
  }

  function google() {
    startTransition(async () => {
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/projects" });
      if (error) toast.error(error.message ?? "Google sign-in failed");
    });
  }

  function demo() {
    startTransition(async () => {
      const res = await signInDemo();
      // A successful demo sign-in redirects, so only failures return here
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isSignUp ? "Create your account" : "Sign in"}</CardTitle>
        <CardDescription>
          {isSignUp ? "Track rankings, research keywords and watch backlinks." : "Welcome back. Pick up where you left off."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {demoEnabled && (
          <Button variant="secondary" onClick={demo} disabled={pending}>
            Explore the demo
          </Button>
        )}
        {googleEnabled && (
          <Button variant="outline" onClick={google} disabled={pending}>
            <GoogleIcon data-icon="inline-start" />
            Continue with Google
          </Button>
        )}
        {(demoEnabled || googleEnabled) && <FieldSeparator>or with email</FieldSeparator>}
        <form onSubmit={submit}>
          <FieldGroup>
            {isSignUp && (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {isSignUp ? "Create account" : "Sign in"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      {signupAllowed && (
        <CardFooter className="text-muted-foreground justify-center text-sm">
          {isSignUp ? "Already have an account?" : "New here?"}&nbsp;
          <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-foreground underline underline-offset-4">
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.05 5.05 0 0 1-2.2 3.3v2.75h3.55c2.08-1.92 3.25-4.74 3.25-8.08Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.75c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.12a6.6 6.6 0 0 1 0-4.24V7.04H2.18a11 11 0 0 0 0 9.92l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 2.18 7.04l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
