"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Mail, BookOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@repo/ui/components/ui/sidebar";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { TeamSwitcher } from "./team-switcher";

/**
 * Navigation item types
 */
interface NavItem {
  title: string;
  href: string;
}

/**
 * Build primary navigation items for workspace-level pages
 */
function getWorkspacePrimaryItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Ask",
      href: `/${orgSlug}/${workspaceName}`,
    },
    {
      title: "Search",
      href: `/${orgSlug}/${workspaceName}/search`,
    },
  ];
}

/**
 * Build management navigation items for workspace-level pages
 */
function getWorkspaceManageItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Sources",
      href: `/${orgSlug}/${workspaceName}/sources`,
    },
    {
      title: "Jobs",
      href: `/${orgSlug}/${workspaceName}/jobs`,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/${workspaceName}/settings`,
    },
  ];
}

/**
 * Build org-level navigation items
 */
function getOrgNavItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Workspaces",
      href: `/${orgSlug}`,
    },
    {
      title: "Settings",
      href: `/${orgSlug}/settings`,
    },
  ];
}

/**
 * Render a set of navigation items
 */
function renderNavItems(items: NavItem[], pathname: string) {
  return items.map((item) => {
    // For Settings, match any settings subpage (org or workspace level)
    const isActive =
      item.title === "Settings"
        ? pathname.startsWith(item.href)
        : pathname === item.href;

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={item.href} prefetch={true}>
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

  // Extract orgSlug and workspaceName from pathname
  // Pathname format: /[slug]/[workspaceName]/...
  const pathParts = pathname.split("/").filter(Boolean);
  const orgSlug = pathParts[0] ?? ""; // [slug]
  const workspaceName = pathParts[1] ?? ""; // [workspaceName]

  // Determine the current context
  const isInOrgSettings = pathname.startsWith(`/${orgSlug}/settings`);
  const _isInWorkspaceSettings = pathname.startsWith(
    `/${orgSlug}/${workspaceName}/settings`,
  );
  const isInWorkspace =
    workspaceName && workspaceName !== "settings" && !isInOrgSettings;

  // Determine mode based on pathname
  const mode =
    pathname.startsWith("/account") || pathname.startsWith("/new")
      ? "account"
      : "organization";

  return (
    <Sidebar
      variant="inset"
      collapsible="none"
      className="border-r border-border/50 group/sidebar"
    >
      {/* Org component header - only show if in org context */}
      {orgSlug && (
        <div className="h-14 flex items-center px-4">
          <TeamSwitcher mode={mode} />
        </div>
      )}
      <SidebarContent>
        {isInWorkspace ? (
          <>
            {/* Primary Navigation - no label */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(
                    getWorkspacePrimaryItems(orgSlug, workspaceName),
                    pathname,
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Manage Section - with label */}
            <SidebarGroup>
              <SidebarGroupLabel>Manage</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItems(
                    getWorkspaceManageItems(orgSlug, workspaceName),
                    pathname,
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          /* Org Navigation - single group, no label */
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderNavItems(getOrgNavItems(orgSlug), pathname)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-muted p-1"
              title="Help"
            >
              <HelpCircle className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-48 p-1">
            <div className="flex flex-col gap-2">
              <a
                href="mailto:support@lightfast.ai"
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-xs text-foreground transition-colors"
              >
                <Mail className="h-3 w-3" />
                <span>Contact Support</span>
              </a>
              <Link
                href="https://lightfast.ai/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-xs text-foreground transition-colors"
              >
                <BookOpen className="h-3 w-3" />
                <span>Help Docs</span>
              </Link>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
}
