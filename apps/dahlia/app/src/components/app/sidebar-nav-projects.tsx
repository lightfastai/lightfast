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
  workspaces,
}: {
  workspaces: RouterOutputs["workspace"]["getAll"] | undefined;
}) {
  if (!workspaces || workspaces.length === 0) return null;
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarMenu>
        {workspaces
          // .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((workspace) => (
            <SidebarMenuItem key={workspace.id}>
              <SidebarMenuButton asChild>
                <Link href={`/workspace/${workspace.id}`}>
                  <span>{workspace.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
