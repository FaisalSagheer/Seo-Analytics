"use client";

import { useState, useTransition } from "react";
import { CopyIcon, EyeIcon, EyeOffIcon, UserPlusIcon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { addUser } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export type AddUserRole = { id: string; name: string; seesAll: boolean };
export type AddUserProject = { id: string; name: string; domain: string };

const EMPTY = { name: "", email: "", password: "" };
// No look-alike characters (0/O, 1/l/I), so the password survives being read out or retyped
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(length = 16) {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Creates an account directly, for when sending an invitation link isn't practical. */
export function AddUserDialog({ roles, projects }: { roles: AddUserRole[]; projects: AddUserProject[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);
  const [roleId, setRoleId] = useState(roles.find((r) => r.name === "Client")?.id ?? roles.find((r) => r.name === "Editor")?.id ?? roles[0]?.id ?? "");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; projects: number } | null>(null);
  const role = roles.find((r) => r.id === roleId);
  const items = roles.map((r) => ({ value: r.id, label: r.name }));

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      // Nothing typed here should linger once the dialog closes, the password least of all
      setForm(EMPTY);
      setProjectIds([]);
      setShowPassword(false);
      setCreated(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addUser({ ...form, roleId, projectIds: role?.seesAll ? [] : projectIds });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Account created for ${res.data.email}`);
      setCreated({ email: res.data.email, password: form.password, projects: res.data.projects });
    });
  }

  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <UserPlusIcon data-icon="inline-start" />
        Add user
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Account created</DialogTitle>
              <DialogDescription>
                Send these sign-in details to them privately. The password is shown only now. They can choose their own later with Forgot password, or
                you can send a reset link from this page.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="au-done-email">Email</FieldLabel>
                <div className="flex gap-2">
                  <Input id="au-done-email" readOnly value={created.email} />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy email" onClick={() => copy(created.email, "Email")}>
                    <CopyIcon />
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="au-done-password">Password</FieldLabel>
                <div className="flex gap-2">
                  <Input id="au-done-password" readOnly value={created.password} className="font-mono" />
                  <Button type="button" variant="outline" size="icon" aria-label="Copy password" onClick={() => copy(created.password, "Password")}>
                    <CopyIcon />
                  </Button>
                </div>
              </Field>
              {!role?.seesAll && (
                <p className="text-muted-foreground text-sm">
                  {created.projects === 0
                    ? "They can't see any project yet. Tick them under Who can see this project in a project's settings."
                    : `They can see ${created.projects} project${created.projects === 1 ? "" : "s"}.`}
                </p>
              )}
            </FieldGroup>
            <DialogFooter>
              <Button onClick={() => reset(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-6">
            <DialogHeader>
              <DialogTitle>Add a user</DialogTitle>
              <DialogDescription>The account works straight away. You set the first password and pass it on yourself.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="au-name">Name</FieldLabel>
                <Input id="au-name" required maxLength={100} autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="au-email">Email</FieldLabel>
                <Input id="au-email" type="email" required autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="au-password">Password</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="au-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    className="font-mono"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm({ ...form, password: generatePassword() });
                      setShowPassword(true);
                    }}
                  >
                    <WandSparklesIcon data-icon="inline-start" />
                    Generate
                  </Button>
                </div>
                <FieldDescription>At least 8 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select items={items} value={roleId} onValueChange={(v) => v && setRoleId(v)}>
                  <SelectTrigger className="w-full" aria-label="Role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {items.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {role?.seesAll && <FieldDescription>This role sees every project.</FieldDescription>}
              </Field>
              {role && !role.seesAll && (
                <Field>
                  <FieldLabel>Projects they can see</FieldLabel>
                  {projects.length === 0 ? (
                    <FieldDescription>No projects yet. You can give access later in a project&apos;s settings.</FieldDescription>
                  ) : (
                    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                      {projects.map((p) => (
                        <label key={p.id} className="flex items-center gap-3 text-sm">
                          <Checkbox
                            aria-label={`Can see ${p.name}`}
                            checked={projectIds.includes(p.id)}
                            onCheckedChange={(c) => setProjectIds((ids) => (c === true ? [...ids, p.id] : ids.filter((id) => id !== p.id)))}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {p.name} <span className="text-muted-foreground">· {p.domain}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </Field>
              )}
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={pending || !form.name || !form.email || form.password.length < 8 || !roleId}>
                {pending && <Spinner data-icon="inline-start" />}
                Create account
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
