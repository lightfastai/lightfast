"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@repo/ui/components/ui/sidebar";

/**
 * Navigation item types
 */
interface NavItem {
  title: string;
  href: string;
}

/**
 * Build navigation items for workspace-level pages
 */
function getWorkspaceNavItems(
  orgSlug: string,
  workspaceName: string,
): NavItem[] {
  return [
    {
      title: "Dashboard",
      href: `/${orgSlug}/${workspaceName}`,
    },
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

  // Build navigation items based on context
  let mainNavItems: NavItem[] = [];

  if (isInWorkspace) {
    // Workspace level: show workspace nav items only
    mainNavItems = getWorkspaceNavItems(orgSlug, workspaceName);
  } else {
    // Org level (root or settings): show org nav items (Workspaces + Settings link)
    // Settings pages have their own SettingsSidebar
    mainNavItems = getOrgNavItems(orgSlug);
  }

  return (
    <Sidebar variant="inset" collapsible="none">
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
