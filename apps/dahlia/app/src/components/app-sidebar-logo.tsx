"use client";

import { SidebarMenu, SidebarMenuItem } from "@repo/ui/components/ui/sidebar";

import { Icons } from "~/app/icons";
import { siteConfig } from "~/config/site";

export const SidebarLogo = () => {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-4 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
            <Icons.logo className="size-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold">{siteConfig.name}</span>
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
