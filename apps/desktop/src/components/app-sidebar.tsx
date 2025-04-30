import { Link } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/components/ui/sidebar";
import { cn } from "@repo/ui/lib/utils";

import { BlenderStatusIndicator } from "./blender-status-indicator";

export function AppSidebar() {
  return (
    <Sidebar variant="inset" className="p-0">
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-6 pt-12 pb-12">
          <span className="font-mono text-xs font-bold tracking-widest uppercase">
            Lightfast Computer
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="divide-y">
        <SidebarGroup className="p-4">
          <BlenderStatusIndicator />
        </SidebarGroup>
        <SidebarGroup className="p-4">
          <SidebarGroupLabel>
            <span>Recents</span>
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/" className={cn("flex items-center gap-2")}>
                  <span>Runs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
