"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createRole, deleteRole, setDefaultRole, updateRole } from "@/lib/actions/team";
import { PERMISSION_KEYS, PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleInput } from "@/lib/validations";
import { ConfirmDelete } from "@/components/confirm-delete";
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
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type RoleView = {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isDefault: boolean;
  seeAllProjects: boolean;
  memberCount: number;
};

export function RolesCard({ roles }: { roles: RoleView[] }) {
  const [pending, startTransition] = useTransition();
  const fallback = roles.find((r) => r.isDefault);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(res.error);
      toast.success(success);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            A role decides what people can change, and whether they see every project or only the ones they&apos;re added to. New sign-ups get the default role.
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
                {!role.seeAllProjects && <Badge variant="outline">Own projects only</Badge>}
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
                  initial={{ name: role.name, description: role.description, permissions: role.permissions, seeAllProjects: role.seeAllProjects }}
                  onSubmit={(input) => updateRole(role.id, input)}
                >
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${role.name}`}>
                    <PencilIcon />
                  </Button>
                </RoleDialog>
                <ConfirmDelete
                  triggerRender={<Button size="icon-sm" variant="ghost" aria-label={`Delete ${role.name}`} disabled={pending || role.isDefault} />}
                  title={`Delete ${role.name}?`}
                  description={
                    role.memberCount
                      ? `${role.memberCount} member${role.memberCount === 1 ? "" : "s"} will move to ${fallback?.name ?? "the default role"}.`
                      : "No one has this role."
                  }
                  details={[
                    { label: "Role", value: role.name },
                    { label: "Members", value: String(role.memberCount) },
                    { label: "Permissions", value: String(role.permissions.length) },
                  ]}
                  confirmLabel="Delete role"
                  onConfirm={() => run(() => deleteRole(role.id), "Role deleted")}
                >
                  <Trash2Icon />
                </ConfirmDelete>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// A new role sees every project unless turned off, which matches roles created before this setting existed
const EMPTY: RoleInput = { name: "", description: "", permissions: [], seeAllProjects: true };

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
            <DialogDescription>Tick what this role can change, and whether it sees every project.</DialogDescription>
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
            <Field orientation="horizontal">
              <Checkbox
                id="role-see-all"
                checked={draft.seeAllProjects}
                onCheckedChange={(c) => setDraft({ ...draft, seeAllProjects: c === true })}
              />
              <FieldContent>
                <FieldLabel htmlFor="role-see-all" className="font-normal">
                  See every project
                </FieldLabel>
                <FieldDescription>
                  Off for client roles: members see only the projects they&apos;ve been added to, on each project&apos;s settings page.
                </FieldDescription>
              </FieldContent>
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
