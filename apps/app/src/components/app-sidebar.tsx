"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { TeamSwitcher } from "@repo/ui/components/app-header/team-switcher";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useOrganizationList } from "@vendor/clerk/client";
import {
  Activity,
  BookOpen,
  Boxes,
  Briefcase,
  HelpCircle,
  Mail,
  MessageSquare,
  Plug,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation item types
 */
interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}

/**
 * Build primary navigation items for org-level pages
 */
function getOrgPrimaryItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Explore",
      href: `/${orgSlug}`,
      icon: MessageSquare,
    },
    {
      title: "Entities",
      href: `/${orgSlug}/entities`,
      icon: Boxes,
    },
  ];
}

/**
 * Build management navigation items for org-level pages
 */
function getOrgManageItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Events",
      href: `/${orgSlug}/events`,
      icon: Activity,
    },
    {
      title: "Sources",
      href: `/${orgSlug}/sources`,
      icon: Plug,
    },
    {
      title: "Jobs",
      href: `/${orgSlug}/jobs`,
      icon: Briefcase,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
      icon: Settings,
    },
  ];
}

/**
 * Render a set of navigation items as a proper component for correct reconciliation
 */
function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return items.map((item) => {
    // For Settings, match any settings subpage (org or workspace level)
    const isActive =
      item.title === "Settings"
        ? pathname.startsWith(item.href)
        : pathname === item.href;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          className={cn(
            "rounded-xl [&>svg]:size-3.5",
            isActive
              ? "text-foreground data-[active=true]:text-foreground"
              : "text-muted-foreground"
          )}
          isActive={isActive}
          size="sm"
        >
          <Link href={{ pathname: item.href }} prefetch={true}>
            <item.icon className="size-3.5" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  });
}

/**
 * PlanetScale-style sidebar component for the Console app
 */
export function AppSidebar() {
  const pathname = usePathname();
  const trpc = useTRPC();
  const { setActive } = useOrganizationList();

  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
  };

  // Extract orgSlug from pathname
  // Pathname format: /[slug]/...
  const pathParts = pathname.split("/").filter(Boolean);
  const orgSlug = pathParts[0] ?? ""; // [slug]

  // Determine mode based on pathname
  const mode =
    pathname.startsWith("/account") || pathname.startsWith("/new")
      ? "account"
      : "organization";

  return (
    <Sidebar className="group/sidebar" collapsible="none" variant="inset">
      {/* Org component header - only show if in org context */}
      {orgSlug && (
        <div className="flex h-14 items-center justify-between px-4">
          <TeamSwitcher
            createTeamHref="/account/teams/new"
            mode={mode}
            onOrgSelect={handleOrgSelect}
            organizations={organizations}
          />
          <Button
            asChild
            className="h-6 w-6 rounded-full text-muted-foreground"
            size="icon"
            title="Search"
            variant="ghost"
          >
            <Link href={{ pathname: `/${orgSlug}/search` }} prefetch={true}>
              <Search className="size-3.5" />
            </Link>
          </Button>
        </div>
      )}
      <SidebarContent>
        {orgSlug && (
          <>
            {/* Primary Navigation - no label */}
            <SidebarGroup className="pt-0">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgPrimaryItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Manage Section */}
            <SidebarGroup collapsible defaultOpen label="Manage">
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItems
                    items={getOrgManageItems(orgSlug)}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="h-8 w-8 rounded-full bg-muted p-1"
              size="icon"
              title="Help"
              variant="outline"
            >
              <HelpCircle className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-48 p-0.5">
            <div className="flex flex-col gap-1">
              <Button
                asChild
                className="justify-start gap-2 rounded-xl text-sm"
                size="sm"
                variant="ghost"
              >
                <a href="mailto:support@lightfast.ai">
                  <Mail className="size-3.5" />
                  Contact Support
                </a>
              </Button>
              <Button
                asChild
                className="justify-start gap-2 rounded-xl text-sm"
                size="sm"
                variant="ghost"
              >
                <Link
                  href="https://lightfast.ai/docs/get-started/overview"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <BookOpen className="size-3.5" />
                  Help Docs
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
