import Link from "next/link";

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

export function AppSidebar() {
  return (
    <Sidebar variant="inset" className="p-0">
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-mono text-xs font-bold tracking-widest uppercase">
            Codename: Media Server
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-4">
        <SidebarGroup className="p-0 py-2">
          <SidebarGroupLabel>
            <span>Overview</span>
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/" className={cn("flex items-center gap-2")}>
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
