"use client";

import Link from "next/link";

import { Icons } from "@repo/ui/components/icons";
import { SidebarMenu, SidebarMenuItem } from "@repo/ui/components/ui/sidebar";

import { siteConfig, siteNav } from "~/config/site";

export const SidebarLogo = () => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link
          href={siteNav.primary.home.href}
          className="hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex items-center gap-4 transition-colors"
          aria-label={`Return to ${siteConfig.name} homepage`}
        >
          <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Icons.logo className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{siteConfig.name}</span>
          </div>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
