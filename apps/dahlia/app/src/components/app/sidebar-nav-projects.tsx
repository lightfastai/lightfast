"use client";

import Link from "next/link";

import { RouterOutputs } from "@repo/api";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";

export function SidebarNavProjects({
  projects,
}: {
  projects: RouterOutputs["projects"]["getProjects"] | undefined;
}) {
  if (!projects || projects.length === 0) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {projects
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((project) => (
            <SidebarMenuItem key={project.id}>
              <SidebarMenuButton asChild>
                <Link href={`/ai/chat/${project.id}`}>
                  <span>{project.id}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
