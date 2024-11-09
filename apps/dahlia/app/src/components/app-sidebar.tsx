"use client";

import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@repo/ui/components/ui/sidebar";

import { api } from "~/trpc/react";
import { SidebarLogo } from "./app-sidebar-logo";
import { NavProjects } from "./app-sidebar-nav-projects";
import { SidebarNavUser } from "./app-sidebar-nav-user";
import { NewChatButton } from "./app-sidebar-new-chat";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: user } = api.user.get.useQuery();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />
        <NewChatButton />
      </SidebarHeader>
      <SidebarContent>
        <NavProjects />
      </SidebarContent>
      <SidebarFooter>
        <SidebarNavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
