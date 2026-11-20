"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import {
  ArchiveIcon,
  BellIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
  MegaphoneIcon,
  StoreIcon,
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
  SparklesIcon,
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
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
          PROJECT_NAV.flatMap((group) => {
            const items = group.items.filter((item) => allowed(item.permission));
            // Merchant Center sits just above Project, even for viewers who can't open Project settings
            const merchant = group.label === "Project" ? [<MerchantNav key="merchant" base={`/projects/${current.id}/shopping`} pathname={pathname} />] : [];
            if (!items.length) return merchant;
            return [
              ...merchant,
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
              </SidebarGroup>,
            ];
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

// Shopping, laid out like Merchant Center's own menu
const MERCHANT_NAV: { label: string; icon: typeof ChartLineIcon; children?: { segment: string; label: string; external?: boolean }[]; segment?: string }[] = [
  { label: "Overview", icon: ShoppingBagIcon, segment: "" },
  { label: "Notifications", icon: BellIcon, segment: "notifications" },
  {
    label: "Products & store",
    icon: ArchiveIcon,
    children: [
      { segment: "products", label: "Products" },
      { segment: "shipping", label: "Shipping and returns" },
      { segment: "store-quality", label: "Store quality" },
      { segment: "reviews", label: "Reviews" },
    ],
  },
  {
    label: "Creative content",
    icon: SparklesIcon,
    children: [
      { segment: "product-studio", label: "Product Studio" },
      { segment: "video-assets", label: "Video assets" },
    ],
  },
  {
    label: "Marketing",
    icon: MegaphoneIcon,
    // Merchant Center's order; the heading opens Promotions (a page here) rather than an external link
    children: [
      { segment: "promotions", label: "Promotions" },
      { segment: "ad-campaigns", label: "Ad campaigns" },
      { segment: "mc/brand", label: "Brand", external: true },
      { segment: "marketing-methods", label: "Marketing methods" },
    ],
  },
  {
    label: "Analytics",
    icon: ChartColumnIcon,
    children: [
      { segment: "summary", label: "Summary" },
      { segment: "product-performance", label: "Products" },
      { segment: "pricing", label: "Pricing" },
      { segment: "best-sellers", label: "Best sellers" },
      { segment: "online-store", label: "Online store" },
      { segment: "physical-stores", label: "Physical stores" },
    ],
  },
  {
    label: "Settings",
    icon: StoreIcon,
    children: [
      { segment: "settings", label: "Business info" },
      { segment: "feeds", label: "Data sources" },
      { segment: "people", label: "People and access" },
      { segment: "apps", label: "Apps and services" },
      { segment: "conversions", label: "Conversion settings" },
      { segment: "automatic-improvements", label: "Automatic improvements" },
    ],
  },
];

function MerchantNav({ base, pathname }: { base: string; pathname: string }) {
  const [closed, setClosed] = useState<string[]>([]);
  const hrefOf = (segment: string) => (segment ? `${base}/${segment}` : base);
  const isActive = (segment: string) => (segment ? pathname.startsWith(hrefOf(segment)) : pathname === base);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Merchant Center</SidebarGroupLabel>
      <SidebarMenu>
        {MERCHANT_NAV.map((item) => {
          if (!item.children) {
            return (
              <Fragment key={item.label}>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={isActive(item.segment!)} tooltip={item.label} render={<Link href={hrefOf(item.segment!)} />}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {/* A line under Notifications, as in Merchant Center */}
                {item.segment === "notifications" && (
                  <li role="none">
                    <SidebarSeparator className="mx-0 my-1" />
                  </li>
                )}
              </Fragment>
            );
          }
          const open = !closed.includes(item.label);
          return (
            <SidebarMenuItem key={item.label}>
              {/* The heading opens its first page (also when the sidebar is collapsed to icons); the arrow folds it */}
              <SidebarMenuButton tooltip={item.label} render={<Link href={hrefOf(item.children[0].segment)} {...(item.children[0].external ? { target: "_blank", rel: "noreferrer" } : {})} />}>
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                aria-label={`${open ? "Collapse" : "Expand"} ${item.label}`}
                aria-expanded={open}
                onClick={() => setClosed(open ? [...closed, item.label] : closed.filter((l) => l !== item.label))}
              >
                {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </SidebarMenuAction>
              {open && (
                <SidebarMenuSub>
                  {item.children.map((c) => (
                    <SidebarMenuSubItem key={c.segment}>
                      {/* External ones open Merchant Center in a new tab */}
                      <SidebarMenuSubButton isActive={isActive(c.segment)} render={<Link href={hrefOf(c.segment)} {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})} />}>
                        <span>{c.label}</span>
                        {c.external && <ExternalLinkIcon className="ml-auto" />}
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
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
