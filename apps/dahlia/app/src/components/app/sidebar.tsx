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
import { SidebarLogo } from "./sidebar-logo";
import { SidebarNavProjects } from "./sidebar-nav-projects";
import { SidebarNavUser } from "./sidebar-nav-user";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: workspaces } = api.workspace.getAll.useQuery();
  const { data: user } = api.user.get.useQuery();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-2 py-1">
        {/** @important we've change padding to match the network-editor header */}
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavProjects workspaces={workspaces} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarNavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
