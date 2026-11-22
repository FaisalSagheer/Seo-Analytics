"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createRole, deleteRole, setDefaultRole, updateRole } from "@/lib/actions/team";
import { describePermissions, PERMISSION_KEYS, PERMISSION_LAYOUT, type Permission, type PermissionAction } from "@/lib/permissions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PagedList } from "@/components/performance/table-pager";

type Area = (typeof PERMISSION_LAYOUT)[number];
const ACTIONS: PermissionAction[] = ["create", "edit", "delete"];
const COLS = "grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-center";
const areaKeys = (area: Area) => area.groups.flatMap((g) => g.pages.flatMap((p) => ACTIONS.map((a) => p[a]).filter((k): k is Permission => k != null)));

/** One area of the sidebar as a card: its pages with a Create, Edit and Delete box each. */
function AreaCard({ area, keys, chosen, setMany }: { area: Area; keys: Permission[]; chosen: Set<Permission>; setMany: (keys: Permission[], on: boolean) => void }) {
  const all = keys.every((k) => chosen.has(k));
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex items-center justify-between border-b px-4 py-3">
        <h4 className="text-sm font-semibold">{area.area}</h4>
        <Button type="button" size="xs" variant="ghost" onClick={() => setMany(keys, !all)}>
          {all ? "Clear section" : "Mark all"}
        </Button>
      </div>
      <div className={`${COLS} text-muted-foreground bg-muted/20 border-b px-4 py-2 text-[11px] font-medium`}>
        <span>Feature</span>
        {ACTIONS.map((a) => (
          <span key={a} className="text-center capitalize">
            {a}
          </span>
        ))}
      </div>
      {area.groups.map((group) => (
        <div key={group.label} className="border-b py-2 last:border-b-0">
          <div className="text-muted-foreground px-4 py-1 text-[10px] font-semibold tracking-wider uppercase">{group.label}</div>
          {group.pages.map((page) => (
            <div key={page.label} className={`${COLS} hover:bg-muted/40 px-4 py-2`}>
              <span className="pr-2 text-sm leading-snug">{page.label}</span>
              {ACTIONS.map((action) => {
                const key = page[action];
                return (
                  <span key={action} className="flex justify-center">
                    {key ? (
                      <Checkbox
                        aria-label={`${page.label}: ${action}`}
                        checked={chosen.has(key)}
                        onCheckedChange={(c) => setMany([key], c === true)}
                      />
                    ) : (
                      <span className="bg-border size-1 rounded-full" />
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

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
      <CardContent>
        <PagedList as="div" className="flex flex-col divide-y" items={roles.map((role) => (
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
                  {role.permissions.length ? describePermissions(role.permissions) : "View only"}
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
        ))} />
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
  const setMany = (keys: Permission[], on: boolean) =>
    setDraft({ ...draft, permissions: on ? [...new Set([...chosen, ...keys])] : [...chosen].filter((p) => !keys.includes(p)) });

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Tick what this role can change, and whether it sees every project.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 md:grid-cols-12">
              <Field className="md:col-span-5">
                <FieldLabel htmlFor="role-name">Role title</FieldLabel>
                <Input id="role-name" placeholder="e.g. SEO Specialist" value={draft.name} maxLength={40} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field className="md:col-span-7">
                <FieldLabel htmlFor="role-description">Description</FieldLabel>
                <Input
                  id="role-description"
                  placeholder="Optional: what this role is responsible for"
                  value={draft.description}
                  maxLength={255}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </Field>
            </div>
            <label htmlFor="role-see-all" className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-xl border p-3.5">
              <Checkbox id="role-see-all" className="mt-0.5" checked={draft.seeAllProjects} onCheckedChange={(c) => setDraft({ ...draft, seeAllProjects: c === true })} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">See every project</span>
                <span className="text-muted-foreground text-xs">
                  Turn off for client roles: members see only the projects they&apos;ve been added to, on each project&apos;s settings page.
                </span>
              </span>
            </label>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Permissions</h3>
                    <Badge variant="secondary">{chosen.size} selected</Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">Viewing a page needs no permission. Tick what this role can do on each page.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setMany(PERMISSION_KEYS, true)}>
                    Mark all
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setMany(PERMISSION_KEYS, false)}>
                    Clear all
                  </Button>
                </div>
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {[["Your website"], ["Merchant Center"]].map((names) => (
                  <div key={names[0]} className="flex flex-col gap-4">
                    {PERMISSION_LAYOUT.filter((a) => names.includes(a.area)).map((area) => (
                      <AreaCard key={area.area} area={area} keys={areaKeys(area)} chosen={chosen} setMany={setMany} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
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
