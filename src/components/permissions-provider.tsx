"use client";

import { createContext, useContext } from "react";
import type { Permission, ViewerRole } from "@/lib/permissions";

const ViewerRoleContext = createContext<ViewerRole | null>(null);

/**
 * The viewer's role, for hiding controls they can't use. Only cosmetic: every
 * server action checks the same permission again.
 */
export function PermissionsProvider({ role, children }: { role: ViewerRole; children: React.ReactNode }) {
  return <ViewerRoleContext.Provider value={role}>{children}</ViewerRoleContext.Provider>;
}

export function useViewerRole() {
  return useContext(ViewerRoleContext);
}

export function useCan(permission: Permission) {
  return useContext(ViewerRoleContext)?.permissions.includes(permission) ?? false;
}
