"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

import { api } from "~/trpc/react";

export function NavProjects() {
  const { data: projects } = api.projects.getProjects.useQuery();
  if (!projects) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton asChild>
                <a href={`/chat/${project.id}`}>
                  <span>{project.id}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
