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
  MegaphoneIcon,
  StoreIcon,
  ChartLineIcon,
  ChevronsUpDownIcon,
  CompassIcon,
  FolderIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlusIcon,
  ScanSearchIcon,
  ShoppingBagIcon,
  SparklesIcon,
  Settings2Icon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import { signOut as authSignOut } from "next-auth/react";
import { toast } from "sonner";
import type { Permission } from "@/lib/permissions";
import { AppLogo } from "@/components/app-logo";
import { useTours } from "@/components/app-tour";
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
  const { restartWelcome, startPageTour, hasPageTour } = useTours();

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
          <SidebarMenuItem data-tour="project">
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
          <>
            <GroupedNav title={current.domain} base={`/projects/${current.id}`} items={PROJECT_NAV} pathname={pathname} allowed={allowed} />
            <GroupedNav title="Merchant Center" titleTourId="merchant" base={`/projects/${current.id}/shopping`} items={MERCHANT_NAV} pathname={pathname} allowed={allowed} />
          </>
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
            <SidebarMenuItem data-tour="google">
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
              <SidebarMenuItem data-tour="team">
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
            {/* Last in the list: it belongs to the open project, so it only shows on a project page */}
            {current && allowed("projects.edit") && (
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.startsWith(`/projects/${current.id}/settings`)} tooltip="Project settings" render={<Link href={`/projects/${current.id}/settings`} />}>
                  <Settings2Icon />
                  <span>Project settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem data-tour="user">
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
                  {hasPageTour && (
                    <DropdownMenuItem onClick={startPageTour}>
                      <CompassIcon />
                      Tour of this page
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={restartWelcome}>
                    <CompassIcon />
                    Take the tour
                  </DropdownMenuItem>
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

type NavLeaf = { segment: string; label: string; permission?: Permission };
type NavEntry = {
  label: string;
  icon: typeof ChartLineIcon;
  /** A tour step can point at this entry */
  tourId?: string;
  /** A line under this entry, as Merchant Center draws one under Notifications */
  divider?: boolean;
  /** A single page... */
  segment?: string;
  permission?: Permission;
  /** ...or a group of pages; its heading opens the first one and the arrow folds it */
  children?: NavLeaf[];
};

// Each product area is split into groups, like Merchant Center's own menu. Pages that do the same kind of
// job sit in one group: traffic reports (Performance, Reports, Referrals) together, the SEO tools
// (Rankings, Site audit, Backlinks) together. Project settings sits at the end of the Account list.
const PROJECT_NAV: NavEntry[] = [
  { label: "Overview", icon: LayoutDashboardIcon, segment: "" },
  {
    label: "Analytics",
    icon: ChartLineIcon,
    tourId: "search",
    children: [
      { segment: "performance", label: "Performance" },
      { segment: "reports", label: "Reports" },
      { segment: "referrals", label: "Referrals" },
    ],
  },
  {
    label: "SEO tools",
    icon: ScanSearchIcon,
    children: [
      { segment: "rankings", label: "Rankings" },
      { segment: "audit", label: "Site audit" },
      { segment: "backlinks", label: "Backlinks" },
    ],
  },
];

// Shopping, laid out like Merchant Center's menu. Summary, Online store and Physical stores are one page
// now (the overview, with a Store filter), and each product's clicks are columns on Products.
const MERCHANT_NAV: NavEntry[] = [
  { label: "Overview", icon: ShoppingBagIcon, segment: "" },
  { label: "Notifications", icon: BellIcon, segment: "notifications", divider: true },
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
    children: [
      { segment: "promotions", label: "Promotions" },
      { segment: "ad-campaigns", label: "Ad campaigns" },
      { segment: "brand", label: "Brand" },
      { segment: "marketing-methods", label: "Marketing methods" },
    ],
  },
  {
    label: "Analytics",
    icon: ChartColumnIcon,
    children: [
      { segment: "pricing", label: "Pricing" },
      { segment: "best-sellers", label: "Best sellers" },
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

/** A sidebar section: single pages and folding groups of pages under one heading. */
function GroupedNav({
  title,
  titleTourId,
  base,
  items,
  pathname,
  allowed,
}: {
  title: string;
  titleTourId?: string;
  base: string;
  items: NavEntry[];
  pathname: string;
  allowed: (permission?: Permission) => boolean;
}) {
  const [closed, setClosed] = useState<string[]>([]);
  const hrefOf = (segment: string) => (segment ? `${base}/${segment}` : base);
  const isActive = (segment: string) => (segment ? pathname.startsWith(hrefOf(segment)) : pathname === base);
  const shown = items.filter((i) => allowed(i.permission));
  if (!shown.length) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel data-tour={titleTourId}>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {shown.map((item) => {
          if (!item.children) {
            return (
              <Fragment key={item.label}>
                <SidebarMenuItem data-tour={item.tourId}>
                  <SidebarMenuButton isActive={isActive(item.segment!)} tooltip={item.label} render={<Link href={hrefOf(item.segment!)} />}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {item.divider && (
                  <li role="none">
                    <SidebarSeparator className="mx-0 my-1" />
                  </li>
                )}
              </Fragment>
            );
          }
          const children = item.children.filter((c) => allowed(c.permission));
          if (!children.length) return null;
          const open = !closed.includes(item.label);
          return (
            <SidebarMenuItem key={item.label} data-tour={item.tourId}>
              {/* The heading opens its first page (also when the sidebar is collapsed to icons); the arrow folds it */}
              <SidebarMenuButton tooltip={item.label} render={<Link href={hrefOf(children[0].segment)} />}>
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
                  {children.map((c) => (
                    <SidebarMenuSubItem key={c.segment}>
                      <SidebarMenuSubButton isActive={isActive(c.segment)} render={<Link href={hrefOf(c.segment)} />}>
                        <span>{c.label}</span>
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
