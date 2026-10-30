"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createRole, deleteRole, setDefaultRole, updateRole } from "@/lib/actions/team";
import { PERMISSION_KEYS, PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleInput } from "@/lib/validations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type RoleView = {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isDefault: boolean;
  memberCount: number;
};

export function RolesCard({ roles }: { roles: RoleView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fallback = roles.find((r) => r.isDefault);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            Everyone can view every project. A role decides what they can change. New sign-ups get the default role.
          </CardDescription>
        </div>
        <RoleDialog title="New role" submitLabel="Create role" onSubmit={(input) => createRole(input)}>
          <Button size="sm">
            <PlusIcon data-icon="inline-start" />
            New role
          </Button>
        </RoleDialog>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {roles.map((role) => (
          <div key={role.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{role.name}</span>
                {role.isSystem && (
                  <Badge variant="secondary">
                    <ShieldCheckIcon />
                    Built-in
                  </Badge>
                )}
                {role.isDefault && <Badge variant="outline">Default</Badge>}
                <span className="text-muted-foreground text-xs">
                  {role.memberCount} member{role.memberCount === 1 ? "" : "s"}
                </span>
              </div>
              {role.description && <p className="text-muted-foreground text-sm">{role.description}</p>}
              {!role.isSystem && (
                <p className="text-muted-foreground text-xs">
                  {role.permissions.length ? role.permissions.map((p) => PERMISSIONS[p]).join(" · ") : "View only"}
                </p>
              )}
            </div>
            {!role.isSystem && (
              <div className="flex shrink-0 gap-1">
                {!role.isDefault && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultRole(role.id), `${role.name} is now the default`)}>
                    Make default
                  </Button>
                )}
                <RoleDialog
                  title={`Edit ${role.name}`}
                  submitLabel="Save role"
                  initial={{ name: role.name, description: role.description, permissions: role.permissions }}
                  onSubmit={(input) => updateRole(role.id, input)}
                >
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${role.name}`}>
                    <PencilIcon />
                  </Button>
                </RoleDialog>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${role.name}`} disabled={pending || role.isDefault} />}
                  >
                    <Trash2Icon />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {role.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {role.memberCount
                          ? `${role.memberCount} member${role.memberCount === 1 ? "" : "s"} will move to ${fallback?.name ?? "the default role"}.`
                          : "No one has this role."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => run(() => deleteRole(role.id), "Role deleted")}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const EMPTY: RoleInput = { name: "", description: "", permissions: [] };

function RoleDialog({
  title,
  submitLabel,
  initial = EMPTY,
  onSubmit,
  children,
}: {
  title: string;
  submitLabel: string;
  initial?: RoleInput;
  onSubmit: (input: RoleInput) => Promise<{ ok: boolean; error?: string }>;
  children: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoleInput>(initial);
  const [pending, startTransition] = useTransition();
  const chosen = new Set(draft.permissions);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await onSubmit(draft);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Role saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from the saved role, not a half-edited draft
        if (next) setDraft(initial);
        setOpen(next);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Viewing projects needs no permission. Tick what this role can change.</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role-name">Name</FieldLabel>
              <Input id="role-name" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="role-description">Description</FieldLabel>
              <Input
                id="role-description"
                placeholder="Optional"
                value={draft.description}
                maxLength={255}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Permissions</FieldLegend>
              <FieldGroup className="gap-3">
                {PERMISSION_KEYS.map((key) => (
                  <Field key={key} orientation="horizontal">
                    <Checkbox
                      id={`perm-${key}`}
                      checked={chosen.has(key)}
                      onCheckedChange={(c) =>
                        setDraft({ ...draft, permissions: c ? [...chosen, key] : [...chosen].filter((p) => p !== key) })
                      }
                    />
                    <FieldLabel htmlFor={`perm-${key}`} className="font-normal">
                      {PERMISSIONS[key]}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending || !draft.name.trim()}>
              {pending && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
