"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ChartColumnIcon,
  ChartLineIcon,
  ChevronsUpDownIcon,
  CompassIcon,
  FolderIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  Link2Icon,
  LinkIcon,
  LogOutIcon,
  PlusIcon,
  ScanSearchIcon,
  ShoppingBagIcon,
  Settings2Icon,
  SettingsIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { signOut as authSignOut } from "next-auth/react";
import { toast } from "sonner";
import type { Permission } from "@/lib/permissions";
import { AppLogo } from "@/components/app-logo";
import { useViewerRole } from "@/components/permissions-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type ProjectLink = { id: string; name: string; domain: string; isDemo: boolean };

type NavItem = { segment: string; label: string; icon: typeof ChartLineIcon; permission?: Permission };

// Grouped like the Account section; a group with nothing the viewer may open isn't shown
const PROJECT_NAV: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [{ segment: "", label: "Overview", icon: LayoutDashboardIcon }] },
  {
    label: "Search & traffic",
    items: [
      { segment: "performance", label: "Performance", icon: ChartLineIcon },
      { segment: "rankings", label: "Rankings", icon: TrendingUpIcon },
      { segment: "audit", label: "Site audit", icon: ScanSearchIcon },
      { segment: "reports", label: "Reports", icon: ChartColumnIcon },
    ],
  },
  {
    label: "Links",
    items: [
      { segment: "referrals", label: "Referrals", icon: Link2Icon },
      { segment: "backlinks", label: "Backlinks", icon: LinkIcon },
    ],
  },
  { label: "Commerce", items: [{ segment: "shopping", label: "Shopping", icon: ShoppingBagIcon }] },
  { label: "Project", items: [{ segment: "settings", label: "Project settings", icon: Settings2Icon, permission: "projects.edit" }] },
];

export function AppSidebar({
  projects,
  user,
}: {
  projects: ProjectLink[];
  user: { name: string; email: string; image?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ projectId?: string }>();
  const current = projects.find((p) => p.id === params.projectId);
  const role = useViewerRole();
  const allowed = (permission?: Permission) => !permission || Boolean(role?.permissions.includes(permission));

  async function signOut() {
    await authSignOut({ redirect: false });
    toast.success("Signed out.");
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/projects" />}>
              <AppLogo />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" className="border" tooltip="Switch project" />}
              >
                <FolderIcon />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-medium">{current?.name ?? "All projects"}</span>
                  <span className="text-muted-foreground truncate text-xs">{current?.domain ?? `${projects.length} project${projects.length === 1 ? "" : "s"}`}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Projects</DropdownMenuLabel>
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} render={<Link href={`/projects/${p.id}`} />}>
                      <span className="truncate">{p.name}</span>
                      <span className="text-muted-foreground ml-auto truncate text-xs">{p.domain}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                {allowed("projects.create") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem render={<Link href="/projects?new=1" />}>
                        <PlusIcon />
                        New project
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {current ? (
          PROJECT_NAV.map((group) => {
            const items = group.items.filter((item) => allowed(item.permission));
            if (!items.length) return null;
            return (
              <SidebarGroup key={group.label ?? "top"}>
                <SidebarGroupLabel>{group.label ?? current.domain}</SidebarGroupLabel>
                <SidebarMenu>
                  {items.map((item) => {
                    const href = `/projects/${current.id}${item.segment ? `/${item.segment}` : ""}`;
                    const active = item.segment ? pathname.startsWith(href) : pathname === href;
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton isActive={active} tooltip={item.label} render={<Link href={href} />}>
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            );
          })
        ) : (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/projects"} tooltip="Projects" render={<Link href="/projects" />}>
                  <CompassIcon />
                  <span>Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/settings" && !current}
                tooltip="Google & API"
                render={<Link href="/settings" />}
              >
                <SettingsIcon />
                <span>Google & API</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {role?.isAdmin && (
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === "/team"} tooltip="Team & roles" render={<Link href="/team" />}>
                  <UsersIcon />
                  <span>Team & roles</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="API docs" render={<Link href="/api/v1/openapi.json" target="_blank" />}>
                <KeyRoundIcon />
                <span>API reference</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8 rounded-lg">
                  {user.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback className="rounded-lg">{initials(user.name)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                </span>
                <ChevronsUpDownIcon className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="min-w-56">
                {role && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Role: {role.name}</DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOutIcon />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
