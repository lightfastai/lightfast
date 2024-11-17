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
  const { data: projects } = api.projects.getProjects.useQuery();
  const { data: user } = api.user.get.useQuery();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNavProjects projects={projects} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarNavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
